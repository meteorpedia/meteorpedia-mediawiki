Extensions.add({
	name: "categories",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	requires: ['mediawiki'],
	description: "Category support",
	hooks: {
		'link': { api: '0.1.0', func: categoryLink },
		'submitEdit': { api: '0.1.0', func: categorySubmitEdit },
		'render': { api: '0.1.0', func: categoryRender }
	},
	plugins: {
		specialPage: {
			'Categories': { api: '0.1.0', func: categorySpecial }
		}
	}
})

/* this would be better as a plugin, but here we write it as a hook for demo purposes */
function categoryLink(hookData) {
	// make invisible
	var re = /^Category:(.*)$/i;
	if (hookData.data.match(re)) {
		hookData.ranSomething = true;
		hookData.data = hookData.data.replace(re, '');
	}
	return hookData;		
}

function categorySubmitEdit(data) {
	var re = /\[\[Category:(.*?)\]\]/gm;
	var match, categories = [], out;

	while ((match = re.exec(data.edit.content)) !== null)
		categories.push(match[1]);

	// Categories work on names, they don't need a category page to exist
	data.page.categories = categories;

	/*
	out  = '<div class="catlinks">\n'
	 	 + '   <a href="/special/Categories">Categories</a>:\n'
		 + '   <ul>\n';

	for (var i=0; i < categories.length; i++)
		out += '<li><a href="/special/Categories/' + categories[i].replace(' ', '_') 
			 + '">' + categories[i] + '</a></li>';

	out += '   </ul>\n'
		 + '</div>\n';

	data.edit.formattedContent += out;
	*/

	return data;

	//var matches = page.
}

function categoryRender(edit) {
	var re = /\[\[Category:(.*?)\]\]/gm;
	var match, categories = [], out;

	while ((match = re.exec(edit.content)) !== null)
		categories.push(match[1]);

	out  = '<div class="catlinks">\n'
	 	 + '   <a href="/special/Categories">Categories</a>:\n'
		 + '   <ul>\n';

	if (categories.length) {
		for (var i=0; i < categories.length; i++)
			out += '<li><a href="/special/Categories/' + categories[i].replace(' ', '_') 
				 + '">' + categories[i] + '</a></li>';

		out += '   </ul>\n'
			 + '</div>\n';

		edit.formattedContent += out;
	}
	
	return edit;
}

if (Meteor.isServer) {
	Meteor.methods({
		'pagesInCategory': function(categoryName) {
			categoryName = categoryName.replace(/_/g, ' ');
			console.log(categoryName);
			return WikiPages.find({categories: categoryName}, {fields: {name: 1}}).fetch();
		}
	})
}

if (Meteor.isClient) {

	Template.mwCategories.categories = function() {
		return Session.get('specialCall');
	}

	Template.mwCategoryList.categories = function() {
		return Session.get('specialCall');
	}

	function categorySpecial(category) {
		if (category) {
			Template.mwCategories.categoryName = category;
			Session.set('specialCall', null);
			Meteor.call('pagesInCategory', category, function(error, result) {
				Session.set('specialCall', result);
			});
			return Template.mwCategories();
		} else {
			return Template.mwCategoryList();
		}
	}

}