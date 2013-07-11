Package.describe({
    summary: "mw stuff for mpedia: categories, {{parser}}, [[links]], tables, etc"
});

Package.on_use(function (api) {
	api.use('extensions', ['client', 'server']);
	api.use(['jquery', 'bootstrap', 'handlebars', 'SyntaxHighlighter'], 'client');

	// Extensions MUST include this line if they include .html files
	api.use('templating', 'client');

	// client files (js, html, css)
	api.add_files(['lib/highlight.js', 'lib/mediawiki.css', 'lib/categories/categories.css',
		'lib/categories/categories.html', 'lib/special/special.html',
		'lib/tables/tables.css', 'lib/links/links.html', 'lib/links/links.css',
		'lib/preview/preview.css', 'lib/toc.js', 'lib/allpages/allpages.html',
		'lib/recentchanges/recentchanges.html', 'lib/mediawiki.html',
		'lib/tags.js', 'lib/search/search.html', 'lib/search/search.css'],
	'client');

	// client files (images)
	api.add_files([
		'lib/links/img/external-link-ltr-icon.png',
		'lib/links/img/lock-icon.png'
	], 'client');

	// common files (js on server+client)
    api.add_files(['lib/mediawiki.js', 'lib/categories/categories.js', 'lib/links/links.js',
    	'lib/cite.js', 'lib/parserFuncs.js', 'lib/special/special.js', 'lib/tables/tables.js',
    	'lib/preview/preview.js', 'lib/allpages/allpages.js', 'lib/recentchanges/recentchanges.js',
    	'lib/namespaces.js', 'lib/search/search.js'],
    ['client', 'server']);
});
