Extensions.add({
	name: "parserFuncs",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	description: "{{#parser:funcs}}: if, etc",
	plugins: {
		parser: {
			'if': { api: '0.1.0', func: parserFuncIf },
			'flag': { api: '0.1.0', func: parserFuncFlag }
		}
	}
})

// https://git.wikimedia.org/raw/mediawiki%2Fextensions%2FParserFunctions/HEAD/ParserFunctions.i18n.magic.php
var parserFuncIfLang = {
	ar: 'لو', arz: 'لو', cs: 'když', eo: 'se', es: 'si', fa: 'اگر', he: 'תנאי',
	hu: 'ha', id: 'jika', ig: 'ȯ_bú', it: 'se', ja: 'もし', ko: '만약', kw: 'mar',
	mg: 'raha', mk: 'ако', ml: 'എങ്കിൽ', mr: ['जर', 'इफ'],
	'nds-il': ['as', 'als'], nl: 'als', nn: 'om', ps: 'که', pt: 'se',
	ru: 'если', sv: 'om', tr: ['eğer', 'eger'], uk: 'якщо', ur: 'اگر',
	uz: 'agar', vi: 'nếu', yi: 'תנאי', zh: '非空式'
};

function parserFuncIf(args) {
	return args.arg1.length ? args.arg2 : (args.arg3 ? args.arg3 : '');
}

function parserFuncFlag(args) {
	return '<img src="http://meteorwiki.com/flags/png/'+args.arg1+'.png"/>';
}
