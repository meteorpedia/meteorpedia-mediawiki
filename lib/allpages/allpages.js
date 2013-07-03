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
})

if (Meteor.isServer) {
	Meteor.methods({
		mw_AllPages: function() {
			return WikiPages.find({}, {fields: {name: 1}}).fetch();
		}
	});
}

if (Meteor.isClient) {

	function AllPages() {

		Template.mwAllPages.pages = function() {
			return Session.get('specialCall');
		}

		Session.set('specialCall', null);
		Meteor.call('mw_AllPages', function(error, result) {
			Session.set('specialCall', result);
		});
		return Template.mwAllPages();

	}
}
