/*
 * TODO:
 * 
 * - Make sure update of dependancy reactively updates everything that uses it
 */

Extensions.add({
	name: "mediawiki",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	description: "mediawiki functionality: {{}}, [[]], tables, links, some wikitext, etc.",
	hooks: {
		'render': { api: '0.1.0', func: renderFuncs, priority: -1 },
		'submitEdit': { api: '0.1.0', func: submitEdit }
	}
})

function submitEdit(data) {
	data = updateDeps(data);
	data = updateLinks(data);
	return data;
}

/*
 * This runs on database submit, looks for anything that looks like a transclusion,
 * check if it's a valid page, and adds it to the list of page dependencies.
 *
 * Page dependencies are used to publish their records (to allow for transclusion)
 * and consequently, to ensure the page refreshes if a dependency is changed.
 *
 */
function updateDeps(data) {
	var content = data.edit.content;

	// ignore <pre>{{stuff}}</pre>
	content = content.replace(/<pre>[\s\S]*?<\/pre>/g, ''); // <pre>{{stuff}}</pre>
	content = content.replace(/\{\{\{.*?\}\}\}/g, '');		// {{{variables}}}

	var re = /\{\{([^ \|\}]*)/g;
	var match, possiblePages = [], pageIds = [], out;
	while ((match = re.exec(content)) !== null) {
		// console.log(match);
		// skip {{#if: }}, {{{variables}}
		if (!match[1].match(/^[#\{]/)) {
			match = match[1].trim();
			if (_.indexOf(possiblePages, match) == -1) {
				var p = WikiPages.findOne({name: match});
				if (p) pageIds.push(p._id);
				possiblePages.push(match);
			}
		}
	}

	/*
		meteor reactivity makes this unnecessary, but we might want to do it anyway
		should probably be recursive, for pages that inlcude pages that include pages...

	// this will cause those pages to rerender with the new template, etc.
	var dependsOnUs = _.pluck(
		WikiPages.find({deps: data.page._id}, { fields: {_id: 1}}).fetch(),
		'_id'
	);	
	console.log('Following pages depend on us, will get updated Ts of '
		+ new Date().getTime() + ': '
		+ JSON.stringify(dependsOnUs));
	WikiPages.update({_id: {$in: dependsOnUs}},
		{$set: { lastDepUpdated: new Date().getTime() }});

	*/

	// TODO, should get full dep chain (for deps that have deps, who have deps...)
	if (pageIds)
		data.page.deps = pageIds;

	return data;
}

function updateLinks(data) {
	var content = data.edit.content;

	content = content.replace(/<pre>[\s\S]*?<\/pre>/g, ''); // <pre>{{stuff}}</pre>

	var re = /\[\[(.*?)\]\]/g;
	var match, possiblePages = [], pageIds = [], pageName, out, p;
	while ((match = re.exec(content)) !== null) {
		// skip category "links"
		if (match[1].match(/^Category\:/))
			continue;

		pageName = match[1].split('|')[0];
		if (_.indexOf(possiblePages, match) == -1) {
			// better to work off page name for links
			// var p = WikiPages.findOne({name: pageName});
			// if (p) pageIds.push(p._id);
			possiblePages.push(pageName);
		}
	}

	if (possiblePages.length > 0)
		data.page.linksTo = possiblePages;

	return data;
}


// List of things to escape in the beginning to ensure we never touch them
var escapeRegExp = {
		 pre: /<pre>[\s\S]*?<\/pre>/g,		// never touch stuff inside a <pre/>
	variable: /\{\{\{(.*?)\}\}\}/g 			// no var substition on CURRENT page
};

function renderFuncs(edit) {
	var content = edit.content;
	var placeholder = new Placeholder();

	// remove (potential) problems
	for (key in escapeRegExp) {
		content = content.replace(escapeRegExp[key], function(fullMatch) {
			return placeholder.wrap(fullMatch, key);
		});
	}

	// noinclude's for THIS CURRENT PAGE, i.e., show them all
	content = content.replace(/<noinclude>[\s\S]*?<\/noinclude>/, '\1');

	// before running any extensions with plugin support, give plugins chance to init
	Extensions.runHooks('mwRenderInit');

	// parser FIRST.  work from inside out, and then unwrap all levels afterwards
	content = parserLoop(content, placeholder, 'parser', /\{\{([^\{\}]*)\}\}/g, parse);
	content = placeholder.unwrapAll(content, 'parser');

	content = tags(content, placeholder);	// <tag></tag> or <tag />, before links
	content = links(content, placeholder);	// [[Internal]], [http:// external]
	content = tables_render(content);		// {| etc |}
	//content = cite(content, placeholder);

	// Best time for MarkDown is now: after functions and before unwrap
	content = marked(content);

	// unsubstitute non-markdown-safe placeholders
	content = placeholder.unwrapPrefixes(content);

	edit.formattedContent = content;
	return edit;
}
Extensions.registerHookType('mwRenderInit', '0.1.0');

/* --- Parser functions --- */

/**
  * Using a non-greedy regexp ('re') to find the smallest / innermost matches, 
  * parse them, placehold (escape) them, and loop again until there are no more
  * matches.  This is how we parse things "inside-out".
  */
function parserLoop(content, placeholder, name, regexp, parser) {
	while (regexp.test(content)) {
		content = content.replace(regexp, function(fullMatch, match) {
			return placeholder.wrap(parser(match, placeholder, arguments), name);
		});
	}
	return content;
}

function parse(content, placeholder) {

	if (content.match(/^#[A-Za-z]*:/)) {

		// parser plugins, e.g. {{#if: stuff}}
		var matches = /^#([A-Za-z]*):([\s\S]*)$/.exec(content);
		var funcName = matches[1], givenArgs = matches[2].split('|');
		var args = {}, newContent;

		for (var i=0; i < givenArgs.length; i++) {
			if (givenArgs[i].match(/^ *[A-Za-z]=/)) {
				matches = /^ *([A-Za-z])=([\s\S]*)/.exec(givenArgs[i]);
				args[[matches[1]]] = matches[2].trim();
			} else {
				args['arg'+(i+1)] = givenArgs[i].trim();
			}
		}
		newContent = Extensions.runPlugin('parser', funcName, args);
		return (newContent === false) ? content : newContent;

	} else if (content == '!') {

		/*
		 * This is a trick from Mediawiki.  They actually create a Template called "!",
		 * but it's much quicker to just process directly.  The trick solves a problem
		 * where you need to include a pipe ("|") one level down, without it affecting
		 * the parser you're passing it too.  http://meta.wikimedia.org/wiki/Template:!
		 *
		 * e.g. {{#if: if {{!}} statement | then {{!}} statement | else {{!}} statement}}
		 *
		 */
		content = '|';

	} else {

		/* Regular transclusion.  Retreieve a template and parse it */

		// fetch the page
		var parts = content.split('|');
		var pageName = parts[0].trim();
		var page = WikiPages.findOne({ name: pageName }, { reactive: true } );
		if (!page)
			return 'No such page: ' + pageName;

		// process supplied variables values
		var dictionary = {};
		for (var i=1; i < parts.length; i++) {
			var assignment = parts[i].split('=', 2);
			dictionary[ assignment[0].trim() ] = assignment[1].trim();
		}

		// get most recent edit, and remove all <noinclude/>'s
		var edit = WikiEdits.findOne({_id: page.lastEditId}, { reactive: true } );
		content = edit.content.replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '');

		// actual variable substition with above values
		var re = /\{\{\{([^\}|]*)(.*?)\}\}\}/g;
		content = content.replace(re, function(fullMatch, varname, fallback) {
			fallback = (fallback.substr(0,1) == '|') ?
				fallback.substr(1).trim() : placeholder.wrap(fullMatch);
			return (typeof dictionary[varname] !== 'undefined') ?
				dictionary[varname] : fallback;
		});

		// perform regular parser stuff on the fetched template
		content = parserLoop(content, placeholder,
			'parser', /\{\{([^\{\}]*)\}\}/g, parse);
		content = placeholder.unwrapLevel(content); // single level
		return content;
	}

//	content = placeholder.unwrapLevel(content);
	return content;
}

function tags(content, placeholder) {
	var re;
	for (tag in Extensions.plugins.tag) {
		// TODO, xpath or better regexp
		re = new RegExp('<('+tag+')\\b([^>]*)>(.*?)<\/'+tag+'>', 'gi');
		content = parserLoop(content, placeholder, 'tagPair', re, tagParse);
		re = new RegExp('<('+tag+')\\b([^>]*)[ ]*\/>', 'gi');
		content = parserLoop(content, placeholder, 'tagSingle', re, tagParse);
	}
	return content;
}
Extensions.registerPluginType('tag', '0.1.0');

function tagAttributes(attrs) {
	if (attrs.trim() == '') return {};

	// TODO, xpath or better regexp
	// matches either attr="value 1", attr='value 2' OR attr=value 
	var re = /([A-Za-z0-9]*)=(["'])(.*?)\2|([A-Za-z0-9]*)=([^'"][^ ]*)/g;
	var dictionary = {};
	while ((match = re.exec(attrs)) !== null) {
		if (match[1])
			dictionary[match[1]] = match[3];
		else
			dictionary[match[4]] = match[5];
	}
	return dictionary;
}

function tagParse(tag, placeholder, matches) {
	return Extensions.runPlugin('tag', tag, {
		attrs: tagAttributes(matches[2]),
		content: matches.length == 6 ? matches[3] : ''
	});
}

// links don't nest, no need to use the parser loop
function links(content, placeholder) {

	// internal links:  [[PageName]], [[Image:File.jpg]], etc.
	content = content.replace(/\[\[(.*?)\]\]/g, function(fullMatch, match) {
		hookData = Extensions.runFirstTrueHook('link', match);
		if (hookData.ranSomething) {
			return hookData.data;
		} else if (match.match(/[A-Za-z]:/)) {
			var matches = /^([A-Za-z]*):([\s\S]*)$/.exec(match);
			var funcName = matches[1];
			var args = matches[2].split('|');
			var newContent = Extensions.runPlugin('link', funcName, args);
			return (newContent === false) ? placeholder.wrap(fullMatch) : newContent;
		} else {
			// a plain, simple internal link
			match = match.split('|');
			if (!match[1]) match[1] = match[0];
			return '<a href="/read/' + match[0].replace(' ', '_')
				+ '">' + match[1] + '</a>';
		}
	});

	// external links: [http://blah.com/ Cool Website]
	content = content.replace(/\[(.*?\:\/\/.*?)( .*?)\]/g, function(fullMatch, url, name) {
		return '<a class="external" href="' + url + '">' + name.trim()
			+ '</a>';
	});
	return content;	
}

/* --- Publish / Subscribe --- */

if (Meteor.isServer) {
	Meteor.publish('currentPageDeps', function(pageName) {
		var self = this;
		var depHandle;
		var handle = WikiPages.find({name: pageName}, {limit: 1}).observe({
			added: function(page) {
				var depPages, depPageEdits, lastEditIds = [];

				depHandle = WikiPages.find({_id: { $in: page.deps }}).observe({
					added: function(depPage) {
						// called once for every page that is a dep of the current page
						self.added('wPages', depPage._id, depPage);
						self.added('wEdits', depPage.lastEditId,
							WikiEdits.findOne({_id: depPage.lastEditId}));
					},
					changed: function(newDepPage, oldDepPage) {
						// a dep page was changed
						if (oldDepPage.lastEditId != newDepPage.lastEditId) {
							self.changed('wPages', newDepPage._id,
								{ lastEditId: newDepPage.lastEditId });
							self.added('wEdits', newDepPage.lastEditId,
								WikiEdits.findOne({_id: newDepPage.lastEditId}));
						}
					}
				});
				// currentPage subscription handles this:
				// self.added('wPages', page._id, page);
			},
			changed: function(oldPage, newPage) {
				// need to check for any new deps?
			}
		});
		self.ready();

		self.onStop(function () {
			if (depHandle)
				depHandle.stop();
    		handle.stop();
  		});
	});	
} else {
	Meteor.startup(function() {
		Deps.autorun(function() {
		 	loading();
			Meteor.subscribe('currentPageDeps', pageName(), stopLoading);
		});
	});
}

/* --- Placeholder functions --- */

function Placeholder() {
	this.lists = {};
}
Placeholder.prototype.wrap = function(content, prefix) {
	if (!prefix) prefix = 'default';
	if (!this.lists[prefix]) this.lists[prefix] = [];

	this.lists[prefix].push(content);
	return '!!PH:' + prefix + ':' + (this.lists[prefix].length-1) + '!!';
}
Placeholder.prototype.unwrapLevel = function(content, prefix) {
	var re = /!!PH:([^:]*):([0-9]+)!!/g;
	var self = this;
	if (!prefix) prefix = 'default';
	return content.replace(re, function(fullMatch, thisPrefix, index) {
		if (thisPrefix != prefix) return fullMatch;
		// console.log('replacing ' + index + ' with ' + self.lists[prefix][index]);
		return self.lists[prefix][index];
	});
}
Placeholder.prototype.unwrapAll = function(content, prefix) {
	var re = /!!PH:([^:]*):([0-9]+)!!/g;
	while (re.test(content)) {
		content = this.unwrapLevel(content, prefix);
	}
	return content;
}
Placeholder.prototype.unwrapPrefixes = function(content) {
	for (prefix in this.lists)
		content = this.unwrapLevel(content, prefix);
	return content;
}
Placeholder.prototype.size = function(prefix) {
	if (!prefix) prefix = 'default';
	return this.lists[prefix] ? this.lists[prefix].length : 0;
}

if (Meteor.isServer) {
	Meteor.methods({
		'reformatPage': function(pageName) {
			var p = WikiPages.findOne({name: pageName});
			var edit = WikiEdits.find({_id: p.lastEditId});
			edit.formattedContent = formatContent(edit.content);
			WikiEdits.update(edit._id, edit);
		}
	});
}