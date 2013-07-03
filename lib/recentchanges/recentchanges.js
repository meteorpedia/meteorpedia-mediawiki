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
})

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

	Meteor.methods({
		mw_RecentChanges: function() {
			var edits, users = {};
			edits = WikiEdits.find({}, {
				sort: {ts: -1},
				limit: 50,
				fields: {pageName: 1, publishedBy: 1, comment: 1, ts: 1}
			}).fetch();

			for (var i=0; i < edits.length; i++)
				if (!users[edits[i].publishedBy])
					users[edits[i].publishedBy] = userInfo(edits[i].publishedBy);

			return { edits: edits, users: users };
		}
	});
}

if (Meteor.isClient) {

	function special_RecentChanges() {

		Template.mwRecentChanges.editsByDate = function() {
			return Session.get('specialCall');
		}

		Session.set('specialCall', null);
		Meteor.call('mw_RecentChanges', function(error, results) {
			var edits = {}, out = [];

			for (var i=0; i < results.edits.length; i++) {
				// for more info on this technique see meteorpedia/lib/history.js
				var userMap = Session.get('history-user-map') || {};
				var date = new Date(results.edits[i].ts).toLocaleDateString();
				var data = {
					ts: results.edits[i].ts,
					deleted: results.edits[i].deleted,
					pageId: results.edits[i].pageId,
					pageName: results.edits[i].pageName,
					date: date,
					time: new Date(results.edits[i].ts).toLocaleTimeString(),
					publishedBy: {
						// 6 = HASH_LEN in meteorpedia/client/profile.js
						userHash: results.edits[i].publishedBy.substr(0,6),
						userName: results.users[results.edits[i].publishedBy]
					},
					comment: results.edits[i].comment
				};
				if (edits[date])
					edits[date].push(data);
				else
					edits[date] = [ data ];
			}
			
			for (date in edits) {
				out.push({'date': date, 'edits': edits[date]});
			}
			Session.set('specialCall', out);
		});
		return Template.mwRecentChanges();

	}
}
