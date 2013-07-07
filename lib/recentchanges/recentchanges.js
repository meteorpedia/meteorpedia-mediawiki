_.defer(function() {
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

	Meteor.publish('mw_RecentChanges', function() {
		var edits = WikiEdits.find({}, {
			sort: {ts: -1},
			limit: 50,
			fields: {pageName: 1, publishedBy: 1, comment: 1, ts: 1}
		});

		var users = [], fetch = edits.fetch();
		for (var i=0; i < fetch.length; i++)
			if (users.indexOf(fetch[i].publishedBy) == -1)
				users.splice(_.sortedIndex(users, fetch[i].publishedBy), 0, fetch[i].publishedBy);
		users = Meteor.users.find({_id: {$in: users}}, {
			fields: { 'profile.name': 1}
		});

		return [edits, users];
	});
}

if (Meteor.isClient) {

	var mw_RecentChangesSub = [];
	function special_RecentChanges() {

		Template.mwRecentChanges.created = function() {
			mw_RecentChangesSub.push(Meteor.subscribe('mw_RecentChanges'));
		}
		Template.mwRecentChanges.destroyed = function() {
			mw_RecentChangesSub.shift().stop();
		}

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
			for (date in tmp)
				out.push({date: date, edits: tmp[date]});

			return out;
		}

		return Template.mwRecentChanges();

	}
}