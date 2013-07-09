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

if (Meteor.isServer) {
	Meteor.publish('mw_AllPages', function(namespace) {
		var selector = namespace ? { namespace: namespace.toLowerCase() }
			: { namespace: {$exists: false }};
		return WikiPages.find(selector, {fields: {name: 1}, sort: {name: 1}});
	});

} else { /* isClient */

	Meteor.startup(function() {
		Deps.autorun(function () {
			Meteor.subscribe('mw_AllPages', Session.get('mw_AllPagesNs'));
		});
	});

	Template.mwAllPages.pages = function() {
		return WikiPages.find({}, {fields: {name: 1}, sort: {name: 1}});
	}
	Template.mwAllPages.namespace = function() {
		return Session.get('mw_AllPagesNs');
	}

}

/* isClient functions */

function AllPages(namespace) {
	Session.set('mw_AllPagesNs', namespace);
	return Template.mwAllPages();
}
