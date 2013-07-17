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
		'specialPage': {
			'Categories': { api: '0.1.0', func: categorySpecial }
		},
		'tag': {
			'categorytree': { api: '0.1.0', func: categoryTree }
		}
	}
});

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
	var content = mwEscape(data.edit.contentParsed);
	var re = /\[\[Category:(.*?)\]\]/gm;
	var match, categories = [], out, name;

	// we use contentParsed to get category links from transcluded content
	while ((match = re.exec(content)) !== null) {
		name = unformatPageName(match[1].split('|', 2)[0]);
		if (_.indexOf(categories, name, true) == -1)
			categories.splice(_.sortedIndex(categories, name), 0, name);
	}

	// Categories work on names, they don't need a category page to exist
	// We check data.page.categories.length too incase we're deleting all
	if (categories.length || (data.page.categories && data.page.categories.length))
		data.page.categories = categories;

	return data;
}

function categoryRenderLinks(data) {
	data.edit.contentParsed = data.edit.contentParsed.replace(
		/\[\[:(Category:.*?)\]\]/g, function(fullMatch, match) {
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
	// Category page, show all pages and subcategories in this page
	if (data.page.namespace == 'category') {
		data.edit.contentParsed += Template.mwCategories({
			categoryName: data.page.name.substr(9),
			name: data.page.name
		});
	}

	// Show a list of all the categories this page is in
	if (data.page.categories && data.page.categories.length) {
		data.edit.contentParsed += Template.mwCategoryPageRender({
			categories: data.page.categories
		});
	}

	return data;
}

if (Meteor.isServer) {

	// pages and subcategories of the given category pages
	Meteor.publish('categoryChildren', function(categories) {
		return WikiPages.find({categories: {$in: categories}},
			{fields: {name: 1, categories: 1, namespace: 1}});
	});
	Meteor.publish('mwCategoryList', function() {
		return WikiPages.find({namespace: 'category'},
			{fields: {name: 1, namespace: 1}});
	});	

} else { /* isClient */

	var categoryChildrenSub;
	Session.setDefault('categoryChildren', []);
	Meteor.startup(function() {
		Deps.autorun(function() {
			var cats = Session.get('categoryChildren');
			categoryChildrenSub = Meteor.subscribe('categoryChildren', cats);
		});
		Deps.autorun(function() {
			var page = Session.get(SESSION_PAGE_NAME_KEY);
			if (page && page.match(/^Category:/)) {
				var name = page.substr(9);
				// we just changed pages: reset array to only this page
				Session.set('categoryChildren', [name]);
			}
		});
	});

	// Single use function for the current page
	Template.mwCategories.categoriesExist = function() {
		return WikiPages.find({categories: this.name.substr(9),
			namespace: 'category'}).fetch().length;
	}

	// Recursive functions, booya! :)
	Template.mwCategories_cats.categories = function() {
		var name = this.name.substr(9);
		return WikiPages.find({categories: name, namespace: 'category'},
			{fields: {name: 1, categories: 1}, sort: { name: 1}});
	}
	Template.mwCategories_cats.hasChildren = function() {
		var name = this.name.substr(9);
		return WikiPages.find({categories: name},
			{fields: {name: 1, categories: 1}, sort: { name: 1}}).fetch().length;
	}

	var openChildren = [];
	Deps.autorun(function() {
		// this was just an experiment.  if we decide to go this route,
		// the openCat function will set this properly without needing to
		// update it afterwards with a reactive computation.
		var children = Session.get('categoryChildren');
		_.each(children, function(child) {
			if (openChildren.indexOf(child) == -1) {
				openChildren.push(child);
				Session.set('mwCatsOpen_' + child, true);
			}
		});
		_.each(openChildren, function(child) {
			if (children.indexOf(child) == -1) {
				openChildren.splice(openChildren.indexOf(child), 1);
				Session.set('mwCatsOpen_' + child, false);
			}
		});
	});
	Template.mwCategories_cats.isOpen = function() {
		var name = this.name.substr(9);
		return Session.get('mwCatsOpen_' + name);
		/*
		var open = Session.get('categoryChildren');
		if (open.indexOf(name) == -1)
			return false;
		return true;
		*/
	}
	Template.mwCategories_cats.isReady = function() {
		return categoryChildrenSub.ready();
	}
	Template.mwCategories.events({
		'click span.catOpen': mwCategoryOpen
	});

	Template.mwCategories_cats.formatCategoryName = function(name) {
		return formatPageName(name.substr(9));
	}


	Template.mwCategories.pagesExist = function() {
		var name = this.name.substr(9);
		return WikiPages.find({categories: name, namespace: {$exists: false}}).fetch().length;
	}
	Template.mwCategories_pages.pages = function() {
		var name = this.name.substr(9);
		return WikiPages.find({categories: name, namespace: {$exists: false}},
			{fields: {name: 1, categories: 1}, sort: { name: 1}});
	}

	/* Show all Categories */

	/*
	 * Unfortunately, due to the way we're inserting special pages, i.e.
	 * {{{specialPage}}} specialPage = function(return Template.page())
	 * the template is created/destroyed multiple times.  So we maintain
	 * a queue like this to ensure we only stop the oldest handle
	 *
	 */

	var mwCategoryListSub = [];
	Template.mwCategoryList.created = function() {
		mwCategoryListSub.push(Meteor.subscribe('mwCategoryList'));
	}
	Template.mwCategoryList.destroyed = function() {
		mwCategoryListSub.shift().stop();
	}
	Template.mwCategoryList.formatCategoryName
		= Template.mwCategories_cats.formatCategoryName;

	Template.mwCategoryList.categories = function() {
		WikiPages.find({namespace: 'category'},
			{fields: {name: 1}, sort: {name: 1}}).fetch();
		return WikiPages.find({namespace: 'category'},
			{fields: {name: 1}, sort: {name: 1}});
	}

	/* Reproduce functionality for categoryTree plugin */
	var copyFromCats = ['formatCategoryName', 'isReady', 'isOpen', 'hasChildren'];
	for (var i=0; i < copyFromCats.length; i++)
		Template.mwCategoryTree[copyFromCats[i]]
			= Template.mwCategories_cats[copyFromCats[i]];
	Template.mwCategoryTree.events({
		'click .catOpen': mwCategoryOpen
	});
	var copyFromCats = ['formatCategoryName', 'isReady', 'isOpen', 'hasChildren'];
	for (var i=0; i < copyFromCats.length; i++)
		Template.mwCategoryTree2[copyFromCats[i]]
			= Template.mwCategories_cats[copyFromCats[i]];
	Template.mwCategoryTree2.events({
		'click .catOpen': mwCategoryOpen
	});
}

/* isClient functions */

function mwCategoryOpen(event) {
	var name = this.name.substr(9);
	var open = Session.get('categoryChildren');
	var idx = open.indexOf(name);
	if (idx == -1)
		open.push(name);
	else
		open.splice(idx, 1);
	Session.set('categoryChildren', open);
}

/* Category special page */

function categorySpecial(category) {
	return Template.mwCategoryList();
}

/*
 * Note, can only have one CategoryTree per page, due to
 * https://github.com/meteor/meteor/issues/281
 *
 */

function categoryTree(data) {
	var name = unformatPageName(data.content);
	return Template.mwCategoryTree({
		name: 'Category:' + name
	});
}
