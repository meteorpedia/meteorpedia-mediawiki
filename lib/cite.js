Extensions.add({
	name: "cite",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	description: "<ref>url</ref>, <references />, like in mediawiki",
	hooks: {
		mwClientRenderInit: { api: '0.1.0', func: function() { refs = []; }}
	},
	plugins: {
		tag: {
			'ref': { api: '0.1.0', func: citeRef },
			'references': { api: '0.1.0', func: citeReferences }
		}
	}
});

var refs;

function citeRef(data) {
	refs.push(data.content);
	return '<sup id="cite_ref-' + refs.length
		+ '" class="reference"><a href="#cite_note-' + refs.length
		+ '">[' + refs.length + ']</a></sup>';
}

function citeReferences(data) {
	var out = '<ol class="references">';
	for (var i=0, refNo=1; i < refs.length; refNo=++i)
		out += '<li id="cite_note-' + refNo
			 + '"><span class="mw-cite-backlink"><a href="#cite_ref-' + refNo
			 +'">↑</a></span> <span class="reference-text"><a class="external free" '
			 + 'href="' + refs[i] + '">' + refs[i] + '</a></span></li>';
	out += '</ol>';
	return out;
}
