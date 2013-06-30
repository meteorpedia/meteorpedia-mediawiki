# Meteorpedia-Mediawiki

This is an extension for Meteorpedia which adds some essential features found in
Mediawiki (the wiki software used by Meteorpedia).

## Initial release

This is a very early release.  More features are coming.  More cleanup to be done.

## Added features

### Categories

Put [[Category:People]] in your page to put it in the 'People' category.  Can be
used more than once.  At the bottom of your page, a box will be displayed showing
a list of links to all the categories your page is in.  Clicking on these links
will go to a page showing links to all the pages in that category.

### Cite / citations / references

Backup facts by placing a &lt;ref&gt;http://source.com/&lt;/ref&gt; after them.
This will be substituted by a superscript clickable number, which will point
to the full URL wherever you place &lt;references /&gt; in your page.

### Links

**Internal links**: easily link to another [[Page]] in the wiki.  Coming soon, you'll
be able to see "what links to this page".  Rename the link like [[Page|this]].  See all the pages that link to a page at /special/WhatLinksHere/pageName.  **External links**: [http://blah.com/ Cool Page]

### Parser functions

Use {{#if: not-empty | true output | false output}} in your page.  The most common
use is during transclusion (see below).  e.g. in the Template, you can write something like
{{#if: {{{name|}}} | His name is {{{name}}} | He has no name }}.

### Tranclusion (for use with Templates)

{{People}} will transclude the *People* page.  Anything in that page that is not
surrounded by &lt;noinclude&gt;&lt;/noinclude&gt; will be inserted into the current
page in that position.  Variables may be passed too, e.g. {{Person | name=Mike}},
where anything that looks like {{{name}}} in the transclused page will be replaced
with 'Mike' in the page it is transcluded to.  You can also use a {{{name|Default}}}.

### Tables

Git flavored markdown actually supports real HTML tables.  But for those familiar
with mediawiki's syntax (and especially when combined with *if* parser functions),
you have it.  http://www.mediawiki.org/wiki/Help:Tables

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
		'ref: { api: '0.1.0', func: function(data) { data.attrs; data.content; } }
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