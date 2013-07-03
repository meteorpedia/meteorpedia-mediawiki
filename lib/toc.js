Extensions.add({
	name: "toc",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	requires: ['mediawiki'],
	description: "Mediawiki style Table of Contents",
	hooks: {
		'mwClientRenderPreMD': { api: '0.1.0', func: autoTOCpre },
		'mwClientRenderPostMD': { api: '0.1.0', func: autoTOCpost }
	}
});

// hide __TOC__ from markdown
function autoTOCpre(data) {
	data.edit.contentParsed = data.edit.contentParsed.replace(/__TOC__|__NOTOC__/,
		function(fullMatch) { return data.placeholder.wrap(fullMatch, 'markdown'); } );
	return data;
}

// we want this to run after wikitext/markdown converted to <h2>'s, etc.
function autoTOCpost(data) {
	var content = data.edit.contentParsed;
	if (content.match(/__NOTOC__/)) {
		data.edit.contentParsed = data.edit.contentParsed.replace(/__NOTOC__/, '');
		return data;
	}

	var out = '<div id="TOC">', lastlevel = 0, count = 0;
	out += '<div>Contents</div>';
	content = content.replace(/<h([2-9])>(.*?)<\/h\1>/g, function(fullMatch, level, name) {
		name = name.trim();

		if (level > lastlevel)
			out += '<ol>';
		else if (level < lastlevel)
			out += '</ol>';

		lastlevel = level; count++;
		out += '<li><a href="#'+name+'">' + name + '</a></li>';
		return '<a name="' + name + '" />\n' + fullMatch;
	});
	out += '</div>';

	if (content.match(/__TOC__/))
		content = content.replace(/__TOC__/, out);
	else if (count > 3)
		content = content.replace(/<h2>/, out+'<h2>'); // before first h2

	data.edit.contentParsed = content;
	return data;
}
