Package.describe({
    summary: "mw stuff for mpedia: categories, {{parser}}, [[links]], tables, etc"
});

Package.on_use(function (api) {
	api.use('extensions', ['client', 'server']);

	// Extensions MUST include this line if they include .html files
	api.use('templating', 'client');

	api.add_files(['lib/mediawiki.css', 'lib/categories/categories.css',
		'lib/categories/categories.html', 'lib/special.html',
		'lib/tables.css', 'lib/linkFuncs.html'],
	'client');

    api.add_files(['lib/mediawiki.js', 'lib/categories/categories.js', 'lib/linkFuncs.js',
    	'lib/cite.js', 'lib/parserFuncs.js', 'lib/special.js', 'lib/tables.js'],
    ['client', 'server']);
});
