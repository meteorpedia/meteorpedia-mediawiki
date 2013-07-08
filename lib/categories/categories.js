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

	// we use contentParsed to get category links from transcluded content
	while ((match = re.exec(data.edit.contentParsed)) !== null)
		categories.push(match[1]);

	// Categories work on names, they don't need a category page to exist
	if (categories.length)
		data.page.categories = categories;

	return data;
}

function categoryRender(data) {
	if (data.page.namespace == 'category') {
		data.edit.contentParsed += Template.mwCategories({
			categoryName: data.page.name.substr(9)
		});
	}

	if (data.page.categories && data.page.categories.length) {
		out  = '<div class="catlinks">\n'
		 	 + '   <a class="internal-link" data-link="special" data-name="Categories"'
		 	 + ' href="/special/Categories">Categories</a>:\n'
			 + '   <ul>\n';

		for (var i=0; i < data.page.categories.length; i++)
			out += '<li><a class="internal-link" data-link="read" '
				 + 'data-name="Category:' + data.page.categories[i].replace(' ', '_')
				 + '" href="/read/Category:'
				 + data.page.categories[i].replace(' ', '_') 
				 + '">' + data.page.categories[i] + '</a></li>';

		out += '   </ul>\n'
			 + '</div>\n';

		data.edit.contentParsed += out;
	}
	return data;
}

if (Meteor.isServer) {

	Meteor.publish('pagesInCategory', function(categoryName) {
		return WikiPages.find({categories: categoryName, namespace: {$exists: false}},
			{fields: {name: 1, categories: 1, namespace: 1}});
	});
	Meteor.publish('catsInCategory', function(categoryName) {
		return WikiPages.find({categories: categoryName, namespace: 'category'},
			{fields: {name: 1, categories: 1, namespace: 1}});
	});
	Meteor.publish('mwCategoryList', function() {
		return WikiPages.find({namespace: 'category'},
			{fields: {name: 1, namespace: 1}});
	});

} else { /* isClient */

	var catsub1, catsub2;
	Meteor.startup(function() {
		Deps.autorun(function() {
			var page = Session.get(SESSION_PAGE_NAME_KEY);
			if (page && page.match(/^Category:/)) {
				var name = page.substr(9);
				catsub1 = Meteor.subscribe('pagesInCategory', name);
				catsub2 = Meteor.subscribe('catsInCategory', name);
			} else {
				if (catsub1) catsub1.stop();
				if (catsub2) catsub2.stop();
			}
		});
	});

	Template.mwCategories.formatCategoryName = function(name) {
		return formatPageName(name.substr(9));
	}
	Template.mwCategories.pagesExist = function() {
		return WikiPages.find({categories: this.categoryName, namespace: {$exists: false}}).fetch().length;
	}
	Template.mwCategories.pages = function() {
		return WikiPages.find({categories: this.categoryName, namespace: {$exists: false}},
			{fields: {name: 1, categories: 1}, sort: { name: 1}});
	}

	Template.mwCategories.categoriesExist = function() {
		return WikiPages.find({categories: this.categoryName, namespace: 'category'}).fetch().length;
	}
	Template.mwCategories.categories = function() {
		return WikiPages.find({categories: this.categoryName, namespace: 'category'},
			{fields: {name: 1, categories: 1}, sort: { name: 1}});
	}

	var mwCategoryListSub = [];
	Template.mwCategoryList.created = function() {
		mwCategoryListSub.push(Meteor.subscribe('mwCategoryList'));
	}
	Template.mwCategoryList.destroyed = function() {
		mwCategoryListSub.shift().stop();
	}
	Template.mwCategoryList.formatCategoryName
		= Template.mwCategories.formatCategoryName;

	Template.mwCategoryList.categories = function() {
		WikiPages.find({namespace: 'category'},
			{fields: {name: 1}, sort: {name: 1}}).fetch();
		return WikiPages.find({namespace: 'category'},
			{fields: {name: 1}, sort: {name: 1}});
	}

	function categorySpecial(category) {
		return Template.mwCategoryList();
	}
}

Extensions.add({
	name: "categories",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	requires: ['mediawiki'],
	description: "Category support",
	hooks: {
		'link': { api: '0.1.0', func: categoryLink },
		'submitEdit': { api: '0.1.0', func: categorySubmitEdit },
		'mwClientRenderPostMD': { api: '1.0.0', func: categoryRender }
	},
	plugins: {
		specialPage: {
			'Categories': { api: '0.1.0', func: categorySpecial }
		}
	}
});
