/* this would be better as a plugin, but here we write it as a hook for demo purposes */
function categoryLink(hookData) {
	// make invisible
	var re = /^Category:.*/i;
	if (hookData.data.match(re)) {
		hookData.ranSomething = true;
		hookData.data = hookData.data.replace(re, '');
	}
	return hookData;
}

function categorySubmitEdit(data) {
	var re = /\[\[Category:(.*?)\]\]/gm;
	var match, categories = [], out, name;

	// we use contentParsed to get category links from transcluded content
	while ((match = re.exec(data.edit.contentParsed)) !== null) {
		name = unformatPageName(match[1].split('|', 2)[0]);
		if (_.indexOf(categories, name, true) == -1)
			categories.splice(_.sortedIndex(categories, name), 0, name);
	}

	// Categories work on names, they don't need a category page to exist
	// We check data.page.categories.length too incase we're deleting all
	if (categories.length || data.page.categories.length)
		data.page.categories = categories;

	return data;
}

function categoryRenderLinks(data) {
	data.edit.contentParsed = data.edit.contentParsed.replace(
		/\[\[:(Category:.*?)\]\]/, function(fullMatch, match) {
			match = match.split('|', 2);
			if (!match[1]) match[1] = match[0];
			match[0] = unformatPageName(match[0]);
			return '<a class="internal-link" data-link="read" '
				+ 'data-name="' + match[0] + '" href="/read/'
				+ match[0] + '">'+match[1]+'</a>';
		});
	return data;
}

function categoryRender(data) {
	if (data.page.namespace == 'category') {
		data.edit.contentParsed += Template.mwCategories({
			categoryName: data.page.name.substr(9)
		});
	}

	if (data.page.categories && data.page.categories.length) {
		data.edit.contentParsed += Template.mwCategoryPageRender({
			categories: data.page.categories
		});
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
		'mwClientRenderPreMD': { api: '0.1.0', func: categoryRenderLinks },
		'mwClientRenderPostMD': { api: '0.1.0', func: categoryRender }
	},
	plugins: {
		specialPage: {
			'Categories': { api: '0.1.0', func: categorySpecial }
		}
	}
});
