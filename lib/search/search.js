Extensions.add({
  	name: "search",
  	version: "0.1.0",
  	author: "Gadi Cohen <dragon@wastelands.net>",
  	description: "Adds a real-time reactive search",
  	hooks: {
  		'activeViews': { api: '0.1.0', func: searchActiveViews },
  		 'submitEdit': { api: '0.1.0', func: submitEdit }
  	}
});

var MW_SEARCH_MIN_LENGTH = 2;
var MW_SEARCH_LIMIT_INITIAL = 10;
var MW_SEARCH_LIMIT_INC = 10;

/*
 * Generate edit.contentSearch:
 *
 * 1) Less to search
 * 2) Less to send over the wire
 * 3) Looks good in search results
 * 4) Shouldn't include HTML; do stuff like that later
*/
function submitEdit(data) {
	// TODO, these should actually hook in from the other functions
	data.edit.contentSearch = data.edit.content
		// template translcusion
		.replace(/\{\{([^\}]*)\}\}/g, function(fullMatch, match) {
			var out = '';
			match = match.split('|');	// {{ template | variables | variables }}
			if (match.length == 1)
				return '';				// template with no page specific info
			for (var i=1; i < match.length; i++) {
				if (match[i].match(/=/))
					// for name=John, show 'John'
					out += match[i].split('=', 2)[1].trim() + ', ';
				else
					out += match[i].trim() + ', ';
			}
			return out.substr(0, out.length-2);  // ', '
		})
		// mardkown links [name](url)
		.replace(/\[(.*?)\]\(.*?\)/g, '$1')
		// remove <tags />
		.replace(/<[^\>]\/>/g, '')
		// unwrap <tag>content</tag>
		.replace(/<([A-Za-z0-9-_]*).*>(.*?)<\/\1>/g, '$2')
		// nonvalid tag we still want to get rid of
		.replace(/<br>/g, '')
		// headings, become "heading."
		.replace(/^(#+) *(.*?) *\1?$/gm, '$2. ')
		.replace(/^=(=+) *(.*?) *\1=$/gm, '$2. ')
		// bold becomes regular
		.replace(/\*\*([\s\S]*?)\*\*/g, '$1')
		// bullets become real bullets, inline
		.replace(/^\* /mg, '● ')
		// remove [[Category:Name]]
		.replace(/\[\[Category:.*?\]\]/g, '')
		// internal links become italic. [[PageName|Alias]]
		.replace(/\[\[(.*?)\]\]/g, function(fullMatch, match) {
			match = match.split('|');
			if (match.length > 1)
				return '<i>'+match[match.length-1]+'</i>';
			else
				return '<i>'+match[0]+'</i>';
		// external links, just show the link text (not url)
		}).replace(/\[(.*?)\]/g, function(fullMatch, match) {
			match = match.split(' ', 2);
			return match[2] || match[1];
		// clean up any plain links in the text
		}).replace(/https?:\/\/([A-Za-z0-9_\-\.\/]*)/g, function(fm, match) {
			var re = /(.*)\/.*\/(.+)/;
			if (match.length > 10) {
				if (re.test(match)) {
					// site.com/.../page
					match = re.exec(match);
					return match[1] + '/.../' + match[2];	
				} else {
					// longsite...name.com (TODO, break near . boundary)
					return match.substr(0,5) + '...'
						+ match.substr(match.length-5,5);
				}
			} else
				return match;
		}).replace(/\n/g, ' ');
	return data;
};

function queryToRegExp(query) {
	if (query.match(/^\/(.*)\/$/))
		query = query.substr(1, query.length-2);
	else
		query = '(' + query + ')';
	return query;
}

// highlight + shorten
function prepareContent(content, query) {
	if (!content)
		return content;

	// HIGHLIGHT: if the query contains a capture group, bold it
	if (query.match(/\(.*\)/)) {
		query = new RegExp(query, 'i');
		content = content.replace(query, '<b>$1</b>');

		// any other visual improvements
		content = content
			.replace(/● /g, '●&nbsp;')
			.replace(/```[A-Za-z]*(.*?) *```/, '<code>$1</code> ');

		// Find the match, and include up to 200 chars before and after
		match = /^(.*?)\b(.{0,200})(<b>.*?<\/b>)(.{0,200})\b(.*?)$/.exec(content);
		if (match)
			return (match[1] ? '...' : '')
				+ match[2] + match[3] + match[4]
				+ (match[5] ? '...' : '');
		else
			// really short or some other reason regex didn't work (title match)
			// TODO, break near word boundaries like above
			return content.substr(0, 400);
	} else {
		content = content
			.replace(/● /g, '●&nbsp;')
			.replace(/```[A-Za-z]*(.*?) *```/, '<code>$1</code> ');
		return content.substr(0,400);
	}
}

/*
// highlight + shorten: old way, too resource intensive, but keep for reference
function prepareContent(content, query) {
	var placeholder;

	if (!content)
		return content;

	// HIGHLIGHT: if the query contains a capture group, bold it
	if (query.match(/\(.*\)/)) {
		placeholder = new Placeholder();

		// escape anything problematic (html tags, entities)
		content =
			content.replace(/<[^\>]\/>|<[A-Za-z0-9-_]*.*>.*?<\/\1>|&\w*;/g,
				function(fullMatch) {
			return placeholder.wrap(fullMatch);
		});

		// placeholder looks like this: !!PH:default:0!!
		// just 
		query = new RegExp(query + '(?![A-Za-z0-9:]*\\!\\!)', 'i');

		// bold all matches
		content = content.replace(query, '<b>$1</b>');

		// unwrap/unescape
		content = placeholder.unwrapLevel(content);

		match = /^(.*?)\b(.{0,200})(<b>.*?<\/b>)(.{0,200})\b(.*?)$/.exec(content);
		if (match)
			return (match[1] ? '...' : '')
				+ match[2] + match[3] + match[4]
				+ (match[5] ? '...' : '');
		else
			return content; // really short
	} else {
		return content.substr(0,400);
	}

}
*/

if (Meteor.isServer) {

	Meteor.publish('mwSearch', function(query, limit) {
		var self = this;
		var initializing = true;
		var pages, pagesOberserve, edits, editsObserve, editIds, re, match;

		if (!query) {
			self.ready();
			return;
		}

		query = queryToRegExp(query);

		// is there a better way to get all the recent edits?
		pages = WikiPages.find({namespace: {$ne: 'template'}},
			{fields: {lastEditId: 1}});

		pagesObserve = pages.observeChanges({
			added: function(id, fields) { self.added('wPages', id, fields) },
			changed: function(id, fields) { self.changed('wPages', id, fields) }
		});

		editIds = _.pluck(pages.fetch(), 'lastEditId');
		edits = WikiEdits.find({
			_id: {$in: editIds},
			$or: [{pageName: {$regex: query, $options: 'i'}},
				{contentSearch: {$regex: query, $options: 'i'}}],
			deleted: {$exists: false}
		}, {
			fields: { pageName: 1, contentSearch: 1, ts: 1},
			limit: limit
		});

		editsOberserve = edits.observeChanges({
			added: function(id, fields) {

				// mark as prepared, minimize data sent over the wire
				fields.preparedSearch
					= prepareContent(fields.contentSearch, query);
				delete fields.contentSearch;
				self.added('wEdits', id, fields)
			},
			changed: function(id, fields) {
				if (fields.contentSearch) {
					fields.preparedSearch
						= prepareContent(fields.contentSearch, query);
					delete fields.contentSearch;
				}
				self.changed('wEdits', id, fields)
			}
		});

		self.ready();
		self.onStop(function() {
			// Seems to be some race conditions here.  TODO: investigate
			try {
				if (pagesObserve)
					pagesObserve.stop();
				if (editsObserve)
					editsObserve.stop();
			} catch (error) {
				if (error.toString() !=
					"TypeError: Cannot call method '_removeObserveHandle' of null")
					console.log(error);
			}
		});
	});

} else { /* isClient */

	// Router.dispose() does not run on this event :(
	var oldPopState = window.onpopstate;
	window.onpopstate = function(event) {
		var query;
		if (oldPopState)
			oldPopState(event);
		query = Session.get('mwSearchQuery');

		// on search page, and user/history goes to a different page
		if (query && event.state && event.state.routeName != 'search') {
			// we do the same thing when disposing the route
			Session.set('mwSearchQuery', '');
			$('#searchBar').val('');
		}
	};

	var mwSearchSub = null;
	Session.setDefault('mwSearchQuery', '');
	Session.setDefault('mwSearchLimit', MW_SEARCH_LIMIT_INITIAL);

	// need access to window.router and Template.pagemenu
	Meteor.startup(function() {
		Deps.autorun(function () {
			var query = Session.get('mwSearchQuery');
			var limit = Session.get('mwSearchLimit');
			mwSearchSub = Meteor.subscribe('mwSearch', query, limit);
		});
		Deps.autorun(function () {
			var query = Session.get('mwSearchQuery');
			if (query != '' && window.router
					&& window.router.currentRoute_.routeName == 'search') {

				// Update the URL and document Title
				window.history.replaceState(history.state, '', '/search/' + query);
				document.title = 'Search: '
					+ (query.match(/^\/.*\/$/)
					? query : ('"'+query+'"'));
			}
		});
		var prevRoute = null;
		Deps.autorun(function () {
			var route;
			var query = Session.get('mwSearchQuery');

			// don't run before we're setup
			if (!window.router)
				return;

			if (query == '') {
				if (window.router.currentRoute_.routeName == 'search') {
					if (prevRoute) {
						window.history.back();
					}
				}
			} else {
				if (window.router.currentRoute_.routeName != 'search') {
					prevRoute = window.router.currentRoute_.routeName;
					window.router.run('search', [query], [{}, 'search', query]);
				}
			}
		});

		var oldRendered = Template.pageMenu.rendered;
		Template.pageMenu.rendered = function() {
			var menu, search;
			if (oldRendered)
				oldRendered();

			// we already added it, rerender
			if ($('#searchBar').length)
				return;

			menu = $('ul.page-menu');
			search = $('<li><span id="searchWrap">'
				+ '<input type="text" id="searchBar" />'
				+ '<i class="icon-search"></i><span>✗</span></span></li>');
			menu.prepend(search);
		};

		Template.pageMenu.events({
			'keyup #searchBar': _.debounce(function(event) {
				var query = $(event.target).val();

				// length 0 = turn off subscription
				if (query.length != 0 && query.length < MW_SEARCH_MIN_LENGTH)
					return;

				Session.set('mwSearchQuery', query);
				Session.set('mwSearchLimit', MW_SEARCH_LIMIT_INITIAL);
			}, 100),
			'click #searchWrap span': function(event) {
				Session.set('mwSearchQuery', '');
				Session.set('mwSearchLimit', MW_SEARCH_LIMIT_INITIAL);
				$('#searchBar').val('');
			}
		});
	}); /* Meteor.startup */

	// Show /regexQuery/ or "query"
	Template.search.query = function() {
		var query = Session.get('mwSearchQuery');

		if (query.match(/^\/.*\/$/))
			return query;
		else
			return '"' + query + '"';
	}

	// TODO, avoid a situation where query.length == 0, don't rely on
	// session variables?   TODO, move editcursor code to deps.autorun
	var editsCursor = null;
	Template.search.results = function() {
		var pages, edits, query = Session.get('mwSearchQuery');

		if (query.length == 0)
			return [];

		query = queryToRegExp(query);

		editIds = _.pluck(WikiPages.find({namespace: {$ne: 'template'}},
			{fields: {lastEditId: 1}}).fetch(), 'lastEditId');

		editsCursor = WikiEdits.find({
			_id: {$in: editIds},
			$or: [{pageName: {$regex: query, $options: 'i'}},
				{preparedSearch: {$regex: query, $options: 'i'}}],
			deleted: {$exists: false}
		}, {fields: { pageName: 1, preparedSearch: 1, ts: 1}});

		return editsCursor;
	}

	/* Most of the infinite scrolling code below */

	Template.search.moreResults = function() {
		return Session.getNonReactive('mwSearchLimit') <= editsCursor.count();
	}

	// whenever #showMoreResults becomes visible, increase results
	var target_visible = false;
	function showMoreVisible() {
		var threshold, target = $('#showMoreResults');
		if (!target.length) return;

		threshold = $(window).scrollTop() + $(window).height() - target.height();

		if (target.offset().top < threshold + 10) {
			if (!target_visible) {
				// console.log('target became visible (inside viewable area)');
				target_visible = true;
				Session.set('mwSearchLimit',
					Session.get('mwSearchLimit') + MW_SEARCH_LIMIT_INC);
			}
		} else {
			if (target_visible) {
				// console.log('target became invisible (below viewable arae)');
				target_visible = false;
			}
		}		
	}
	$(window).scroll(showMoreVisible);

	/* -- */

	Template.search.rendered = function() {
		var query = Session.get('mwSearchQuery');
		if ($('#searchBar').val() == '' && query)
			$('#searchBar').val(query);
		$('#searchBar').focus();

		// #showMoreVisible is always visible on first render, so only
		// check if we've finished loading our initial data.
		if (mwSearchSub && mwSearchSub.ready())
			showMoreVisible();		
	}

	Session.getNonReactive = function (key) {
		return Deps.nonreactive(function () { return Session.get(key); });
	};

	Template.searchResult.lastmod = function() {
		var date = new Date(this.ts).toDateString();
		if (date == new Date().toDateString()) {
			return timeAgo(this.ts);
		} else {
			return date;
		}
	}
}

/* Client functions */

function searchActiveViews(activeViews) {
	function Search_() {
		this.init_();
	}
	Search_.prototype = _.clone(View);
	SP = Search_.prototype;
	SP.name = 'search';
	SP.pathGenerator_ = function(query) {
		return [this.name, query].join('/');
	};
	SP.render = function(state, searchView, query) {
		if (arguments.length == 5)
			query = '/' + arguments[3] + '/';
		Session.set('mwSearchQuery', query);
	};
	SP.dispose = function() {
		// we do the same in window.onpopstate: back to non-search
		Session.set('mwSearchQuery', '');
		Session.set('mwSearchLimit', MW_SEARCH_LIMIT_INITIAL);
		$('#searchBar').val('');
	}
	Search = Search_;

	activeViews.push(Search);
	return activeViews;	
}

if (typeof ngettext == 'undefined')
function ngettext(sing, plural, num) {
    return num==1 ? sing : plural.replace(/%1/, num);
}

function timeAgo(time) {
    // difference in seconds
    var diff, now = new Date(), date = new Date(time);
	diff = Math.round((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) // minute
	//  return ngettext('a second ago', '%1 seconds ago',
        return ngettext('a few seconds ago', 'a few seconds ago',
        	diff);
    if (diff < 3600) // hour
        return ngettext('a minute ago', '%1 minutes ago',
            Math.round(diff / 60));
    if (diff < 82800) // 23 hrs  
        return ngettext('an hour ago', '%1 hours ago',
                Math.round(diff/3600));
    if (diff < 2635200) // 30.5 days
        return ngettext('a day ago', '%1 days ago',
                Math.round(diff/86400));
    if (diff < 28987200) // 11 months
        return ngettext('last month', '%1 months ago',
                Math.round(diff/2635200));

    return ngettext('a year ago', '%1 years ago',
                Math.round(diff/31536000));         
}
