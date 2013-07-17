Meteor.methods({
	'readCountIncr': function(pageId) {
	  WikiPages.update({_id: pageId}, {$inc: { readCount: 1 }});
	}
});

Meteor.publish('topPages', function() {
		return WikiPages.find({readCount: {$exists: true}}, {
			fields: { name: 1, readCount: 1 },
			sort: { readCount: -1 },
			limit: 10
		});	
	}
);
