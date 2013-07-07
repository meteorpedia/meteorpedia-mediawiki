_.defer(function() {
	Extensions.add({
		name: "AllPages",
		version: "0.1.0",
		author: "Gadi Cohen <dragon@wastelands.net>",
		description: "Shows a list of all pages on the wiki",
		plugins: {
			specialPage: {
				'AllPages': { api: '0.1.0', func: AllPages }
			}
		}
	});
});

if (Meteor.isServer) {
	Meteor.publish('mw_AllPages', function() {
		return WikiPages.find({}, {fields: {name: 1}, sort: {name: 1}});
	});
}

if (Meteor.isClient) {

	var mwSub_AllPages = [];
	Template.mwAllPages.created = function() {
		mwSub_AllPages.push(Meteor.subscribe('mw_AllPages'));
	}
	Template.mwAllPages.destroyed = function() {
		mwSub_AllPages.shift().stop();
	}

	Template.mwAllPages.pages = function() {
		return WikiPages.find({}, {fields: {name: 1}, sort: {name: 1}});
	}

	function AllPages() {
		return Template.mwAllPages();
	}
}
