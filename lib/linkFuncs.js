Extensions.add({
	name: "linkFuncs",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	description: "[[link:funcs]]: Image, etc.",
	plugins: {
		link: {
			'Image': { api: '0.1.0', func: linkImage }
		},
		specialPage: {
			'WhatLinksHere': { api: '0.1.0', func: whatLinksHere }
		}
	}
})

function linkImage(data) {
	// coming soon :)
	return '<img src="' + data[0] + '"/>';
}

if (Meteor.isServer) {
	Meteor.methods({
		mw_whatLinksHere: function(pageName) {
			pageName = pageName.replace(/_/g, ' ');
			return WikiPages.find({linksTo: pageName}, {fields: {name: 1}}).fetch();	
		}
	})
}

if (Meteor.isClient) {

	function whatLinksHere(pageName) {
		if (pageName) {

			Template.linkFuncs_whatLinksHere.pageName = pageName;

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

}
