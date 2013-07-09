Extensions.add({
	name: "RecentChanges",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	description: "Shows a list of recent changes on the Wiki",
	plugins: {
		specialPage: {
			'RecentChanges': { api: '0.1.0', func: special_RecentChanges }
		}
	}
});

if (Meteor.isServer) {

	var userInfos = {};
	function userInfo(id) {
		if (userInfos[id])
			return userInfos[id];

		var user = Meteor.users.findOne({_id: id});
		var row = user.profile.name ? user.profile.name : 'Anonymous';
		//var row = { userName: user.profile.name ? user.profile.name : 'Anonymous' };
		userInfos[id] = row;
		return row;
	}

	Meteor.publish('mw_RecentChanges', function(limit) {
		var edits = WikiEdits.find({}, {
			sort: {ts: -1},
			limit: limit,
			fields: {pageName: 1, publishedBy: 1, comment: 1, ts: 1}
		});

		// return all the users who have made changes too
		var users = [], fetch = edits.fetch();
		for (var i=0; i < fetch.length; i++)
			if (_.indexOf(users, fetch[i].publishedBy, true) == -1)
				users.splice(_.sortedIndex(users, fetch[i].publishedBy), 0, fetch[i].publishedBy);
		users = Meteor.users.find({_id: {$in: users}}, {
			fields: { 'profile.name': 1}
		});

		return [edits, users];
	});

} else { /*isClient */

	Meteor.startup(function() {
		Template.special.events({
			'click a.previous-history': function(event) {
				// in theory we should just export funcs from client/lib/history.js
				var name, ts, el;
				event.preventDefault();
				el = $(event.target);
				name = el.attr('data-name');
				ts = el.attr('data-ts');
				window.router.run('history', [name, 'diff', 'previous', ts],
					[{}, 'history', name, 'diff', 'previous', ts]);
			}
		});
	});

	Session.setDefault('mw_RecentChanges', 20);
	Meteor.startup(function () {
		Deps.autorun(function () {
			if (Session.equals(SESSION_PAGE_TYPE, 'session')
				&& Session.equals(SESSION_PAGE_NAME_KEY, 'RecentChanges'))
					Session.set('mw_RecentChanges', 50);
				else
					Session.set('mw_RecentChanges', 20);
		});
		Deps.autorun(function () {
			var maxResults = Session.get('mw_RecentChanges');
			Meteor.subscribe('mw_RecentChanges', maxResults);
		});
	});

	Template.mwRecentChanges.moreResults = function() {
		// if we got less results than we asked for, there's nothing more to show
		return !(WikiPages.find().fetch().length < Session.get('mw_RecentChanges'));
	}

	$(window).scroll(function() {
		var threshold, target = $('#showMoreResults');
		if (!target.length) return;

		// scroll position of top of page + window height + target's height
		threshold = $(this).scrollTop() + $(this).height() + target.height();

		if (target.offset().top < threshold) {
			if (!target.data('visible')) {
				// console.log('target became visible (inside viewable area)');
				target.data('visible', true);
				Session.set('mw_RecentChanges',
					Session.get('mw_RecentChanges') + 10);
			}
		} else {
			if (target.data('visible')) {
				// console.log('target became invisible (below viewable arae)');
				target.data('visible', false);
			}
		}
	});

	Template.mwRecentChanges.editsByDate = function() {
		var date, data;
		var edits = WikiEdits.find().fetch();
		var users = Meteor.users.find().fetch();
		var tmp = {}, out=[], userIdx = {};

		for (var i=0; i < users.length; i++) {
			if (!userIdx[users[i]._id])
				userIdx[users[i]._id] = users[i]
					&& users[i].profile && users[i].profile.name
					? users[i].profile.name : 'Anonymous'
		}

		for (var i=0; i < edits.length; i++) {
			date = new Date(edits[i].ts).toLocaleDateString();
			data = {
				ts: edits[i].ts,
				deleted: edits[i].deleted,
				pageId: edits[i].pageId,
				pageName: edits[i].pageName,
				date: date,
				time: new Date(edits[i].ts).toLocaleTimeString(),
				publishedBy: {
					// 6 = HASH_LEN in meteorpedia/client/profile.js
					userId: edits[i].publishedBy,
					userHash: edits[i].publishedBy.substr(0,6),
					userName: userIdx[edits[i].publishedBy]
				}, // profileInfo(edits[i].publishedBy, userMap),
				comment: edits[i].comment
			};
			if (tmp[date])
				tmp[date].push(data);
			else
				tmp[date] = [data];
		}

		// convert to array for handlebars			
		for (date in tmp) {
			tmp[date].sort(function(a,b) { return b.ts-a.ts; });
			out.push({date: date, edits: tmp[date]});
		}

		out.sort(function(a, b) {
			a = new Date(a.date); b = new Date(b.date);
			return b-a;
		});

		return out;
	}
}

/* isClient functions.. to move */

function special_RecentChanges() {
	return Template.mwRecentChanges();
}
