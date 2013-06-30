if (Meteor.isClient) {

	Extensions.add({
      	name: "special",
      	version: "0.1.0",
      	author: "Gadi Cohen <dragon@wastelands.net>",
      	description: "Creates a /special space to be used by plugins",
      	hooks: {
      		'activeViews': { api: '0.1.0', func: specialActiveViews }
      	}
	});

	function specialActiveViews(activeViews) {
		var SP;
		function Special_() {
			this.init_();
		}
		Special_.prototype = _.clone(View);
		SP = Special_.prototype;
		SP.name = 'special';
		SP.pathGenerator = function(pageName) {
			console.log(pageName);
			return [this.name, pageName].join('/');
		};
		SP.render = function(state, viewName, pageName, option) {
			Session.set(SESSION_PAGE_NAME_KEY, pageName);
		 	Session.set(SESSION_PAGE_TYPE, viewName);
		 	Session.set('special_option', option);
		};

		Special = Special_;

		activeViews.push(Special);
		return activeViews;
	}

	Template.special.specialPages = function() {
		var out = [];
		for (name in Extensions.plugins.specialPage) {
			out.push({
				name: name
			});
		}
		return out;
	}

    Template.special.specialPage = function() {
        return Extensions.runPlugin('specialPage',
                Session.get(SESSION_PAGE_NAME_KEY),
                Session.get('special_option'));
    };
    Extensions.registerPluginType('specialPage', '0.1.0');
    
}