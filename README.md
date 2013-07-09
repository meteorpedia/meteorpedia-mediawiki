# Meteorpedia-Mediawiki

This is an extension for Meteorpedia which adds some essential features found in Mediawiki (the wiki software used by Wikipedia).

## Initial release

This is a very early release.  More features are coming.  More cleanup to be done.

## Added features

### Categories

Put [[Category:People]] in your page to put it in the 'People' category.  Can be
used more than once for multiple cateogries.  At the bottom of your page, a box
will be displayed showing a list of links to all the categories your page is in.  Clicking on these links will go to a page showing links to all the pages in that category.

### Cite / citations / references

Backup facts by placing a &lt;ref&gt;http://source.com/&lt;/ref&gt; after them.
This will be substituted by a superscript clickable number, which will point
to the full URL wherever you place &lt;references /&gt; in your page.

### Links

**Internal links**: easily link to another [[Page]] in the wiki.  Coming soon, you'll
be able to see "what links to this page".  Rename the link like [[Page|this]].  Links to non-existing pages will be in a different color.  See all the pages that link to a page at /special/WhatLinksHere/pageName.  **External links**: [http://blah.com/ Cool Page]

### Parser functions

Use {{#if: not-empty | true output | false output}} in your page.  The most common
use is during transclusion (see below).  e.g. in the Template, you can write something like
{{#if: {{{name|}}} | His name is {{{name}}} | He has no name }}.

### Previews

When editing, the user is presented with a "Source" and "Preview" tab.  Parsing occurs on the server (i.e. translusion templates, etc rather than sending them all across) and final
rendering happens on the client (to avoid sending formatting data across).  This system
pretty much plugs in directly to the regular meteorpedia-mediawiki save/read process.

### Special Pages

Adds hooks for other extensions to provide their own /special/ pages.  As examples, there
is an *AllPages* special page (shows all the pages in the wiki) and a *RecentChanges* page.

### Table of Contents

Automatically create a Table of Contents if there are more than 3 headings in the
contents.  By default the TOC will appear just before the first &lt;h2&gt;, but
you can also put a \_\_TOC\_\_ in your page to choose where it will appear, or a
\_\_NOTOC\_\_ to disable the feature completely.

### Tables

Git flavored markdown actually supports real HTML tables.  But for those familiar
with mediawiki's syntax (and especially when combined with *if* parser functions),
you have it.  http://www.mediawiki.org/wiki/Help:Tables

### Tranclusion (for use with Templates)

{{People}} will transclude the *People* page.  Anything in that page that is not
surrounded by &lt;noinclude&gt;&lt;/noinclude&gt; will be inserted into the current
page in that position.  Variables may be passed too, e.g. {{Person | name=Mike}},
where anything that looks like {{{name}}} in the transclused page will be replaced
with 'Mike' in the page it is transcluded to.  You can also use a {{{name|Default}}}.

## Extending this extension

We provide a number of plugins to make it easier for you to write your own extensions
making use of our code.

### parser plugin hook, e.g. {{#if: arg1 | arg2 | etc}}

```js
plugins: {
	parser: {
		'if': { api: '0.1.0', func: function(args) { ... } }
	}
}
```

### tag plugin hook, e.g. <ref>

```js
plugins: {
	tag: {
		'ref': { api: '0.1.0', func: function(data) { data.attrs; data.content; } }
	}
}
```

### specialPage plugin hook, for e.g. /special/Categories/People

```js
plugins: {
	specialPage: {
		'Categories': { api: '0.1.0', func: function(option) { // option=People above } }
	}
}
```

### mwRenderInit - called when this extension's render code starts

You might want to use this to initialize items before any of your other plugins are called.

```js
hooks: {
	'mwRenderInit': { api: '0.1.0', func: function() { } }
}
```

There are some other (currently) undocumented hooks which you may find in the source code.

## TODO

Javascript should be separated into client-side and server-side.  The temporary measure of wrapping in a Meteor.isServer/isClient *if* statement is useless for
declaring functions.  On Firefox, functions declared in an *if* statement will not
be available in the Extensions.add clause at the top of the page.  And in any case,
these functions are defined regardless of their position in the if-else clause on
other browsers / node.  Suggest file-common.js, file-server.js, file-client.js

* http://statichtml.com/2011/spidermonkey-function-hoisting.html
* http://stackoverflow.com/questions/4069100/why-cant-i-use-a-javascript-function-before-its-definition-inside-a-try-block

