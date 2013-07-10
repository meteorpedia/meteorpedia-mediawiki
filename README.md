The **meteorpedia-mediawiki** smart package adds some features from [MediaWiki](http://www.mediawiki.org/wiki/MediaWiki), as detailed below:

## Initial release

This is a very early release.  More features are coming.  More cleanup to be done.

## Added features

### Categories

Put <code>[[Category:People]]</code> in your page to put it in the **People**
category.  Can be used more than once for multiple categories.  At the bottom
of your page, a box will be displayed showing a list of links to all the
categories your page is in.  Clicking on these links will go to a page showing
links to all the pages in that category.

### Cite / citations / references

Backup facts by placing a <code>&lt;ref&gt;http://source.com/&lt;/ref&gt; </code>after them.
This will be substituted by a superscript clickable number, which will point
to the full URL wherever you place <code>&lt;references /&gt;</code> in your page.

### Links

**Internal links**: easily link to another <code>[[Page]]</code> in the wiki.  Coming soon, you'll
be able to see "what links to this page".  Rename the link like <code>[[Page|this]]</code>, or go straight to a heading <code>[[Page#heading|see this]]</code>.  Links to non-existing pages will be in a red.  See all the pages that link to a page at /special/WhatLinksHere/pageName.  **External links**: <code>[http://blah.com/ Cool Page]</code>

### Parser functions

Use <code>{{#if: not-empty | true output | false output}}</code> in your page.  The most common
use is during transclusion (see below).  e.g. in the Template, you can write something like
<code>{{#if: {{{name|}}} | His name is {{{name}}} | He has no name }}</code>

### Previews

When editing, the user is presented with a "Source" and "Preview" tab.  Parsing occurs on the server (i.e. translusion templates, etc rather than sending them all across) and final
rendering happens on the client (to avoid sending formatting data across).  This system
pretty much plugs in directly to the regular meteorpedia-mediawiki save/read process.

### Redirects

If the first line of a page content is <code>#REDIRECT [[PageName]]</code>, when the user visits this page he will automatically be shown the content of *PageName*, with a hint explaining that he was redirected from the original page.  e.g. [[raix]]

### Special Pages

Adds hooks for other extensions to provide their own /special/ pages.  As examples, there
is an [AllPages](/special/AllPages) special page (shows all the pages in the wiki) and a [RecentChanges](/special/RecentChanges) page (with infinite scrolling).

AllPages will additionally create a /mw_AllPages_sitemap.xml file, with all the
pages in the wiki and their lastmod time.  Add <code>Sitemap: http://url.com/mw_AllPages_sitemap.xml</code> to your /public/robots.txt.

### Table of Contents

Automatically create a Table of Contents if there are more than 3 headings in the
contents.  By default the TOC will appear just before the first &lt;h2&gt;, but
you can also put a <code>\_\_TOC\_\_</code> in your page to choose where it will appear, or a
<code>\_\_NOTOC\_\_</code> to disable the feature completely.

### Tables

Git flavored markdown actually supports real HTML tables.  But for those familiar
with mediawiki's syntax (and especially when combined with *if* parser functions),
you have it.  http://www.mediawiki.org/wiki/Help:Tables

### Tranclusion (for use with Templates)

<code>{{People}}</code> will transclude the *People* page.  Anything in that page that is not
surrounded by <code>&lt;noinclude&gt;&lt;/noinclude&gt;</code> will be inserted into the current
page in that position.  Variables may be passed too, e.g. <code>{{Person | name=Mike}}</code>,
where anything that looks like <code>{{{name}}}</code> in the transclused page will be replaced
with 'Mike' in the page it is transcluded to.  You can also use a <code>{{{name|Default}}}</code>.

## Extending this extension

We provide a number of plugins to make it easier for you to write your own extensions
making use of our code.

### parser plugin hook <code>e.g. {{#if: arg1 | arg2 | etc}}</code>

```js
plugins: {
    parser: {
		'if': { api: '0.1.0', func: function(args) { ... } }
	}
}
```

### tag plugin hook <code>e.g. &lt;ref&gt;</code>

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