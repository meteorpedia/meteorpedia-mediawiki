function findBrush(lang) {
	for (brush in SyntaxHighlighter.brushes)
		for (var i=0; i < SyntaxHighlighter.brushes[brush].aliases.length; i++)
			if (SyntaxHighlighter.brushes[brush].aliases[i] == lang)
				return SyntaxHighlighter.brushes[brush];
	return false;
}

marked.setOptions({
	highlight: function(code, lang) {
		var brush = findBrush(lang);
		if (brush) {
			var highlighter = new brush();
			highlighter.init();
			return highlighter.getHtml(code);
		} else {
			return code;
		}
	}
});
