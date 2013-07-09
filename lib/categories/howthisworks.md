http://www.meteorpedia.com/edit/Trees

Once you get your head around the recursion, it's actually disgusting how easy it is to write powerful tree browsing code in Meteor.  The example we're going to use is from the wiki itself; you can see it in action on any category page, e.g. [[:Category:Design Patterns]].

== Our Example: Category Wiki Pages ==

The wiki consists of Pages.  A page can be either a Regular Page or a Category Page.  Category Pages can contain either Regular Pages, or other Category Pages (i.e. sub-categories).

=== Database structure ===

```js
Page: {
   name: pageName,
   namespace: 'category' // doesn't exist otherwise
   categories: ['Category1', 'Category2']
}
```

As you can see, Categories for our purposes (a wiki) work just with names; obviously for a more traditional use-case you'd prefer to use id's.

=== Templates ===

First let's look at the template code before we delve into the Javascript.

**Template.mwCategories**:
```html
<template name="mwCategories">
	{{#if categoriesExist}}
		<h2>Subcategories</h2>
		<ol>
			{{> mwCategories_cats}}
		</ol>
	{{/if}}

	{{#if pagesExist}}
		<h2>Pages in category "{{formatPageName categoryName}}"</h2>
		<ol>
			{{> mwCategories_pages}}
		</ol>
	{{/if}}
</template>
```

**Template.mwCategories_cats**:
```html
<template name="mwCategories_cats">
	{{#each categories}}
		<li><span class="catOpen">[<b>{{#if isOpen}}-{{else}}+{{/if}}</b>]</span>
			<a class="internal-link" data-link="read" data-name="{{name}}"
			href="/read/{{name}}">{{formatCategoryName name}}</a>
			{{#if isOpen}}
				{{#if hasChildren}}
					<ol>
					{{> mwCategories_cats}}
					{{> mwCategories_pages}}
					</ol>
				{{else}}
					{{#if isReady}}
						<br />No pages or subcategories
					{{else}}
						<span class="loading"></span>
					{{/if}}
				{{/if}}
			{{/if}}
		</li>
	{{/each}}
</template>
```

**Template.mwCategories_pages**:
```html
<template name="mwCategories_pages">
	{{#each pages}}
		<li><a class="internal-link" data-link="read" data-name="{{name}}"
		href="/read/{{name}}">{{formatPageName name}}</a></li>
	{{/each}}
</template>
```

1. The *mwCategories* template is the "base" template.  This is the code that shows the pages and subcategories inside a page (again, see [[Category:Design Patterns]] for an example rendering).

2. The *mwCategories_cats* is the main recursive template, which will list all the children (pages and subcategories) of a category page.

3. The *mwCategories_pages* just lists the pages of a current page.  It's used separately in the *mwCategories* to show only the category's pages, and then again in the *mwCategories_cats* template to show pages beneath subcategories.

4. Don't worry about the *isOpen* and *isReady* stuff yet, we'll get to it later.

=== Template Helpers ===

**Template.mwCategories helpers**:
```js
	// Single use function for the current page
	Template.mwCategories.categoriesExist = function() {
		return WikiPages.find({categories: this.name.substr(9),
			namespace: 'category'}).fetch().length;
	}
	Template.mwCategories.pagesExist = function() {
		var name = this.name.substr(9);
		return WikiPages.find({categories: name, namespace: {$exists: false}}).fetch().length;
	}
```

These are just used in the "base" template to see which data to display.  The substr(9) just strips off the "Category:" prefix from the page name.  Slightly more interesting is:

**Template.mwCategory helper**:
```js
	Template.mwCategories_pages.pages = function() {
		var name = this.name.substr(9);
		return WikiPages.find({categories: name, namespace: {$exists: false}},
			{fields: {name: 1, categories: 1}, sort: { name: 1}});
	}
```

Also quite straightforward; we retrieve a list of Pages that are IN category "name" (*categories* is an array and mongo will search inside it for us).  The namespace clause ensures we only get regular pages, and not category pages (in the 'category' namespace).

Note, Meteor doesn't actually use the *fields* argument on the client side, but we hope that one day it will :)  (To ensure reactivity only on the specified fields and not any change in the document)

Finally, we get to...

**Template.mwCategories_cats helpers**:
```js
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
```

It's so simple because of the *this* keyword in template instances, it just makes perfect sense to the template inside itself (recursion), as it gets all the info it needs from the calling template.

=== Reactivity ===

Our example fetches the relevant data in real time from the server.  It would be even easier if we published the full data set in the beginning (you could basically just leave out all the below).  Nevertheless, let's see how.

**Server code**:

```js
	// pages and subcategories of the given category pages
	Meteor.publish('CategoryChildren', function(categories) {
		return WikiPages.find({categories: {$in: categories}},
			{fields: {name: 1, categories: 1, namespace: 1}});
	});
```

A publish function which accepts an array of Category names, for whom we want all the children for (pages and subcategories).

```js
	var CategoryChildrenSub;
	Session.setDefault('CategoryChildren', []);
	Deps.autorun(function() {
		var cats = Session.get('CategoryChildren');
		CategoryChildrenSub = Meteor.subscribe('CategoryChildren', cats);
	});
```

Here you can see that we maintain a session variable called 'CategoryChildren'.  Whenever it's updated, Meteor will renew the subscription with all the given pages.

Now we can go back to our final helper functions.

```js
	Template.mwCategories_cats.isReady = function() {
		return CategoryChildrenSub.ready();
	}
	Template.mwCategories_cats.isOpen = function() {
		var name = this.name.substr(9);
		var open = Session.get('CategoryChildren');
		if (open.indexOf(name) == -1)
			return false;
		return true;
	}
```

*isOpen* just returns true/false depending on whether or not our page is in the CategoryChildren array.  *isReady* checks our handle for our subscribe function to see if the subscription is ready (we use this in the template to show a spinner while we're waiting, or alternatively a message that no children exist).

```js
	Template.mwCategories.events({
		'click span.catOpen': function(event) {
			var name = this.name.substr(9);
			var open = Session.get('CategoryChildren');
			var idx = open.indexOf(name);
			if (idx == -1)
				open.push(name);
			else
				open.splice(idx, 1);
			Session.set('CategoryChildren', open);
		}
	});
```

Again, we are seriously aided by template instances.  This single event will look at the clicked on category, and toggle it's appearance in our CategoryChildren session variable array.  Of course once that array is updated, our subscribe function is re-executed, ensuring that the server publishes all our needed information.

== Credits ==

* [https://atmosphere.meteor.com/package/meteorpedia-mediawiki meteorpedia-mediawiki] smart package by Gadi Cohen

[[Category:UI]]
[[Category:Data]]
