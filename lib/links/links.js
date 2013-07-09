Extensions.add({
	name: "linkFuncs",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	description: "[[Internal link|Alias]], [http://blah.com/ external], [[Image:etc]]",
	hooks: {
		'mwClientRenderPreMD': { api: '0.1.0', func: linksClientRender },
			     'submitEdit': { api: '0.1.0', func: updateLinks },
		   	   'readPageName': { api: '0.1.0', func: readPageName }
	},
	plugins: {
		link: {
			'Image': { api: '0.1.0', func: linkImage }
		},
		specialPage: {
			'WhatLinksHere': { api: '0.1.0', func: whatLinksHere }
		}
	}
});


if (Meteor.isServer) {
	Meteor.methods({
		mw_whatLinksHere: function(pageName) {
			pageName = unformatPageName(pageName);
			selector = {};
			selector['linksTo.'+pageName] = { $exists: true };
			return WikiPages.find(selector, {fields: {name: 1}}).fetch();	
		}
	});

	function updateLinks(data) {
		var content = mwEscape(data.edit.contentParsed);

		var re = /\[\[(.*?)\]\]/g;
		var match, pages = {}, pageIds = [], pageName, out, page;
		while ((match = re.exec(content)) !== null) {
			// skip category "links"
			if (match[1].match(/^Category\:/))
				continue;

			pageName = unformatPageName(match[1].split('|')[0]);
			pageName = pageName.split('#')[0];
			if (!pages[pageName]) {
				page = WikiPages.findOne({name: pageName});
				pages[pageName] = !!page;
			}
		}

		if (_.size(pages) != 0)
			data.page.linksTo = pages;

		return data;
	}	

} else { /* isClient */

	var updateLinks = null;

	// stuff to do after the image is drawn
	Meteor.startup(function() {
		var oldReadRender = Template.read.rendered;
		Template.read.rendered = function() {
			if (oldReadRender)
				oldReadRender();

			// add external class to anchors with no classes
			$('#main a[href]:not([class])').each(function() {
				if (this.getAttribute('href').match(/\:\/\//))
					this.setAttribute('class', 'external');
			});

			// go to #anchor if specified (after render)
			if (location.hash) {
				// try not interfere with stuff that might be added in future
				var a = location.hash.substr(1).split('&', 2)[0];
				a = $('a[name="'+formatPageName(a) + '"]');
				if (a && a.offset())
					$(document.body).scrollTop(a.offset().top);
			}

		}
	});	
}

/* isClient functions */

function whatLinksHere(pageName) {
	if (pageName) {

		Template.linkFuncs_whatLinksHere.pageName = formatPageName(pageName);

		Template.linkFuncs_whatLinksHere.pages = function() {
			return Session.get('specialCall');
		}

		Session.set('specialCall', null);
		Meteor.call('mw_whatLinksHere', pageName, function(error, result) {
			Session.set('specialCall', result);
		});
		return Template.linkFuncs_whatLinksHere();

	} else {

		return '<p>Try /special/WhatLinksHere/pageName</p>';
	}
}

function linksClientRender(data) {
	data = linksToolbar(data);
	data = linksParse(data);
	return data;
}

// links don't nest, no need to use the parser loop
function linksParse(data) {
	var content = data.edit.contentParsed;

	// internal links:  [[PageName]], [[Image:File.jpg]], etc.
	content = content.replace(/\[\[(.*?)\]\]/g, function(fullMatch, match) {
		hookData = Extensions.runFirstTrueHook('link', match);
		if (hookData.ranSomething) {
			return hookData.data;
		} else if (match.match(/^[A-Za-z]+:/)) {
			var matches = /^([A-Za-z]*):([\s\S]*)$/.exec(match);
			var funcName = matches[1];
			var args = matches[2].split('|');
			var newContent = Extensions.runPlugin('link', funcName, args);
			return (newContent === false) ?
				data.placeholder.wrap(fullMatch) : newContent;
		} else {
			// a plain, simple internal link
			match = match.split('|');				// Alias, e.g. Page|Show
			match[0] = match[0].split('#',2)[0];	// Page#Heading
			if (!match[1]) match[1] = match[0];
			match[0] = unformatPageName(match[0]);
			if (data.page.linksTo[match[0]]) {
				return '<a class="internal-link" data-link="read" '
					+ 'data-name="' + match[0] + '" href="/read/' + match[0]
					+ '">' + formatPageName(match[1]) + '</a>';
			} else {
				// potentially go straight to /edit/
				return '<a class="internal-link new" data-link="read" '
					+ 'data-name="' + match[0] + '" href="/read/' + match[0]
					+ '">' + formatPageName(match[1]) + '</a>';
			}
		}
	});

	// external links: [http://blah.com/ Cool Website], but avoid [markdown](links)
	content = content.replace(/\[([A-Za-z]*?\:\/\/.*?)( .*?)\]/g, function(fullMatch, url, name) {
		return '<a class="external" href="' + url + '">' + name.trim()
			+ '</a>';
	});

	data.edit.contentParsed = content;
	return data;	
}

function linksToolbar(data) {
	data.toolbar.push('<li><a class="special-link" data-name="WhatLinksHere"'
		+ 'data-option="' + data.page.name + '" href="/special/WhatLinksHere/'
		+ data.page.name + '">WhatLinksHere</a></li>');
	return data;
}

function linkImage(data) {
	// coming soon :)
	return '<img src="' + data[0] + '"/>';
}


function readPageName(pageName) {
	// Strip off Page#Heading
	return pageName.split('#',2)[0];
}
