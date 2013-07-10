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
		         'render': { api: '1.0.0', func: clientRender, priority: -1 },
		     'submitEdit': { api: '0.1.0', func: submitEdit, priority: -1 },
		'submitEditAfter': { api: '0.1.0', func: submitEditAfter }
	}
});

// List of things to escape in the beginning to ensure we never touch them
// Order is important!
var escapeRegExp = {
		 pre: /<pre>[\s\S]*?<\/pre>/g,		// never touch stuff inside a <pre/>
	    code: /<code>[\s\S]*?<\/code>/g, 	// never touch
	variable: /\{\{\{(.*?)\}\}\}/g 			// do it at the end
};

/**
 * This will either escape (with placeholders) or remove code which you
 * probably want to ignore, e.g. <pre>, <code>, {{{variable}}}.
 *
 * @param String content - the content you want to escape
 * @param Placeholder placeholder - placeholder instance to use (optional)
 * @returns escaped content
 *
 * If no placeholder is provided, the matches will simply be removed.
 *
 */
mwEscape = function(content, placeholder) {
	for (key in escapeRegExp) {
		content = content.replace(escapeRegExp[key], function(fullMatch) {
			return placeholder ? placeholder.wrap(fullMatch, key) : '';
		});
	}
	return content;	
}

function submitEdit(data) {
	/* api 0.1.0, we get: { page: page, edit: edit } */
	// TODO, add hook, combine functions below
	data = serverParse(data);
	data = updateDeps(data);
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
	var content = mwEscape(data.edit.content);

	var re = /\{\{([^\|\}]*).*/g;
	var match, possiblePages = [], pageIds = [], out;
	while ((match = re.exec(content)) !== null) {
		// skip {{#if: }}, {{{variables}}
		if (!match[1].match(/^[#\{]/)) {
			match = unformatPageName(match[1].trim());
			// ":Page"->"Page" or "Page"->"Template:Page"
			if (match.substr(0,1) == ':')
				match = match.substr(1);
			else
				match = 'Template:' + match;

			if (_.indexOf(possiblePages, match) == -1) {
				// better to work off names in case user creates Template after, etc.
				// var p = WikiPages.findOne({name: match});
				// if (p) pageIds.push(p._id);
				possiblePages.push(match);
			}
		}
	}

	if (possiblePages.length)
		data.page.deps = possiblePages;

	return data;
}

function submitEditAfter(data) {
	// After saving a dep, reparse lastEdit of all pages that depend on this one
	reprocessPageAndDeps({deps: data.page.name});
}

function serverParse(data) {
	var placeholder = new Placeholder();
	var content = mwEscape(data.edit.content, placeholder);

	// The CURRENT page (not transcluded), i.e. show noinclude's, hide includeonly's
	content = content.replace(/<noinclude>([\s\S]*?)<\/noinclude>/g, '$1');
	content = content.replace(/<includeonly>[\s\S]*?<\/includeonly>/g, '');

	// parser FIRST.  work from inside out, and then unwrap all levels afterwards
	content = parserLoop(content, placeholder, 'parser',
		/\{\{([^\{\}]*)\}\}/g, parse);
	content = placeholder.unwrapAll(content, 'parser');

	// page variables
	content = content.replace(/\{\{(.*?)\}\}/g, function(fullMatch, variable) {
		switch(variable) {
			case 'FULLPAGENAME': return data.page.name;
			default: return fullMatch;
		};
	});

	// everything else
	content = placeholder.unwrapPrefixes(content);

	// we don't use this anymore; minimize data sent over the wire
	data.edit.formattedContent = '*';

	data.edit.contentParsed = content;
	return data;
}

var redirectedFrom = {};
function clientRender(data) {
	// check for redirect
	var match, re = /^#REDIRECT \[\[([^\]]*)\]\]/;
	if (match = re.exec(data.edit.content)) {
		var page, pageName, edit;

		pageName = unformatPageName(match[1]);
		page = WikiPages.find({name: pageName});
		if (page) {
			Session.set(SESSION_PAGE_NAME_KEY, pageName);
			redirectedFrom[pageName] = data.page.name; // redirector
			return data;
		}
	}
	data.placeholder = new Placeholder();
	data.edit.contentParsed
		= mwEscape(data.edit.contentParsed, data.placeholder);
	data.toolbar = [];

	if (redirectedFrom[data.page.name]) {
		data.edit.contentParsed
			= '<div id="contentSub">(Redirected from '
			+ '<a href="internal-link" data-link="read" data-name="'
			+ redirectedFrom[data.page.name] + '"'
			+ 'href="/read/' + redirectedFrom[data.page.name] + '">'
			+ redirectedFrom[data.page.name] + '</a>)</div>\n'
			+ data.edit.contentParsed;
	}

	// before running any extensions with plugin support, give plugins chance to init
	Extensions.runHooks('mwClientRenderInit');

	data = Extensions.runHookChain('mwClientRenderPreMD', data);

	// Best time for MarkDown is now: after functions and before unwrap
	data.edit.contentParsed = marked(data.edit.contentParsed);	
	// unwrap anything marked as unsafe just for markdown
	data.edit.contentParsed = data.placeholder.unwrapLevel(
		data.edit.contentParsed, 'markdown');

	data = Extensions.runHookChain('mwClientRenderPostMD', data);

	// unwrap 1 level of everything else
	data.edit.contentParsed
		= data.placeholder.unwrapPrefixes(data.edit.contentParsed);

	//data.edit.content = new Handlebars.SafeString(data.edit.contentParsed);
	data.edit.formattedContent = data.edit.contentParsed;
	return data;
}
Extensions.registerHookType('mwClientRenderInit', '0.1.0');
Extensions.registerHookType('mwClientRenderPreMD', '0.1.0');
Extensions.registerHookType('mwClientRenderPostMD', '0.1.0');

function wikitext(data) {
	var content = data.edit.contentParsed;

	// headings
	content = content.replace(/==(=*)(.*?)=*==/g, function(fullMatch, level, name) {
		var level = 2 + level.length;
		return '<h'+level+'>' + name.trim() + '</h'+level+'>';
	});

	// bold
	content = content.replace(/'''(.*?)'''/g, function(fullMatch, text) {
		return '<b>' + text + '</b>';
	});

	data.edit.contentParsed = content;
	return data;
}
Extensions.addHook('mwClientRenderPreMD', 'mediawiki', { api: '0.1.0', func: wikitext });

/* --- Parser functions --- */

// TODO, need to check for loops (page1 includes page2, page2 includes page1, etc)

/**
  * Using a non-greedy regexp ('re') to find the smallest / innermost matches, 
  * parse them, placehold (escape) them, and loop again until there are no more
  * matches.  This is how we parse things "inside-out".
  */
parserLoop = function(content, placeholder, name, regexp, parser) {
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
		var pageName, origPageName = parts[0].trim();

		// ":Page"->"Page" or "Page"->"Template:Page"
		if (origPageName.substr(0,1) == ':')
			pageName = origPageName.substr(1);
		else
			pageName = 'Template:' + origPageName;

		var page = WikiPages.findOne({ name: pageName }, { reactive: true } );
		if (!page)
			return '{{' + origPageName + '}}';

		// process supplied variables values
		var dictionary = {};
		for (var i=1; i < parts.length; i++) {
			var assignment = parts[i].split('=', 2);
			dictionary[ assignment[0].trim() ] = assignment[1].trim();
		}

		// get most recent edit, and remove all <noinclude/>'s
		var edit = WikiEdits.findOne({_id: page.lastEditId}, { reactive: true } );
		content = edit.content.replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '');
		content = content.replace(/<includeonly>([\s\S]*?)<\/includeonly>/g, '$1');

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

/* --- Publish / Subscribe --- */

/*
 * We don't use this anymore.  The parser now executes server side, so the client
 * doesn't need to retrieve all the deps, which is much faster.  Code is left here
 * for references purposes in case we need to do anything similar in the future
 */

/*
if (Meteor.isServer) {
	Meteor.publish('currentPageDeps', function(pageName) {
		var self = this;
		var depHandle;
		var handle = WikiPages.find({name: pageName}, {limit: 1}).observe({
			added: function(page) {
				var depPages, depPageEdits, lastEditIds = [];

				if (page.deps)
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
*/

if (Meteor.isClient) {
	Meteor.startup(function() {
		var oldEditRendered = Template.edit.rendered;
		Template.edit.rendered = function() {
			if (oldEditRendered)
				oldEditRendered();
			var target = $('.span3.pull-right');
			if (!target.data('mwWrapped')) {
				target.html(Template.mwEditHelp());
				target.data('mwWrapped', true);
			}
		}
	});
}

/* --- Global helper functions --- */

if (Meteor.isClient) {
	Handlebars.registerHelper('formatPageName', function(name) {
		return formatPageName(name);
	});
}
formatPageName = function(name) {
	return name.replace(/_/g, ' ');
}
unformatPageName = function(name) {
	return name.replace(/ /g, '_');
}

/* --- Other server side stuff --- */

if (Meteor.isServer) {
	function reprocessPageAndDeps(selector, history) {
		var edit, page, pages = WikiPages.find(selector).fetch();
		if (!history) history = [];

		for (var i=0; i < pages.length; i++) {				
			page = pages[i];

			// make sure each page is only process once
			if (_.indexOf(history, page._id) == -1)
				history.push(page._id);
			else
				continue;

			console.log('Reprocessing: ' + page.name);

			edit = WikiEdits.findOne({_id: page.lastEditId});
			hookData = Extensions.runHookChain('submitEdit', {
				edit: edit, page: page
			});
  			edit = hookData.edit; page = hookData.page;
			WikiEdits.update(edit._id, edit);
			WikiPages.update(page._id, page);

			// now do the same thing for all pages that depend on this one
			reprocessPageAndDeps({deps: page.name }, history);

			// if any pages linked to us before we existed, update.
			// TODO, make hooks for this
			var selector = {};
			selector['linksTo' + page.name] = false;
			reprocessPageAndDeps(selector, history);
		}
	}

	Meteor.methods({
		'reprocessPage': function(pageName) {
			var selector = pageName ? { name: pageName } : {};
			reprocessPageAndDeps(selector);
		}
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

/* Debug */

/*

function logRenders () {
    _.each(Template, function (template, name) {
      var oldRender = template.rendered;
      var counter = 0;
 
      template.rendered = function () {
        console.log(name, "render count: ", ++counter);
        oldRender && oldRender.apply(this, arguments);
      };
    });
  }
  Meteor.startup(function() { logRenders(); });

*/