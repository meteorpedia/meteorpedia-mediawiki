Extensions.add({
	name: "mw-tags",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	description: "Add hooks to let other extensions create <tags> for client rendering",
	hooks: {
		'mwClientRenderPreMD': { api: '0.1.0', func: tags }
	}
});

function tags(data) {
	var re, content = data.edit.contentParsed;
	// TODO, xpath or better regexp
	for (tag in Extensions.plugins.tag) {
		// <tag>hello</tag>
		re = new RegExp('<('+tag+')\\b([^>]*)>(.*?)<\/'+tag+'>', 'gi');
		content = parserLoop(content, data.placeholder, 'tagPair', re, tagParse);
		// <tag />
		re = new RegExp('<('+tag+')\\b([^>]*)[ ]*\/>', 'gi');
		content = parserLoop(content, data.placeholder, 'tagSingle', re, tagParse);
	}
	data.edit.contentParsed = content;
	return data;
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
