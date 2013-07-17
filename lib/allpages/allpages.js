Extensions.add({
	name: "AllPages",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	description: "Shows a list of all pages on the wiki",
	plugins: {
		specialPage: {
			'AllPages': { api: '0.1.0', func: AllPages }
		}
	}
});

Number.prototype.pad = function(length) {
    var str = this.toString();
    while (str.length < length)
        str = "0" + str;
    return str;
}

if (Meteor.isServer) {
	Meteor.publish('mw_AllPages', function(namespace) {
		var selector = namespace ? { namespace: namespace.toLowerCase() }
			: { namespace: {$exists: false }};
		return WikiPages.find(selector, {fields: {name: 1}, sort: {name: 1}});
	});

	// TODO: 1) gzip, 2) sitemap index + other types + sitemap for old content
	__meteor_bootstrap__.app.use(function(req, res, next) {
  		var out, urlStart, pages, d;
		if (req.url !== '/mw_AllPages_sitemap.xml') {
    		return next();
  		}

  		urlStart = req.headers['x-forwarded-proto'] + '://'
  			+ req.headers.host + '/read/';
  		pages = WikiPages.find().fetch();

  		out = '<?xml version="1.0" encoding="UTF-8"?>\n\n'
  			+ '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n';

  		_.each(pages, function(page) {
  			var w3cDateTimeTS, d = new Date(page.lastUpdated);
  			w3cDateTimeTS = d.getUTCFullYear() + '-'
  				+ (d.getUTCMonth()+1).pad(2) + '-'
  				+ d.getUTCDate().pad(2) + 'T'
  				+ d.getUTCHours().pad(2) + ':'
  				+ d.getUTCMinutes().pad(2) + ':'
  				+ d.getUTCSeconds().pad(2) + '+00:00';

  			out += '   <url>\n'
  				 + '      <loc>' + urlStart + escape(page.name) + '</loc>\n'
  				 + '      <lastmod>' + w3cDateTimeTS + '</lastmod>\n'
  				 + '   </url>\n\n';
  		});

  		out += '</urlset>\n';

  		res.writeHead(200, {'Content-Type': 'application/xml'});
  		res.end(out, 'utf8');
	    return;
	});

} else { /* isClient */

	Meteor.startup(function() {
		Deps.autorun(function () {
			Meteor.subscribe('mw_AllPages', Session.get('mw_AllPagesNs'));
		});
	});

	Template.mwAllPages.pages = function() {
		return WikiPages.find({}, {fields: {name: 1}, sort: {name: 1}});
	}
	Template.mwAllPages.namespace = function() {
		return Session.get('mw_AllPagesNs');
	}

}

/* isClient functions */

function AllPages(namespace) {
	Session.set('mw_AllPagesNs', namespace);
	return Template.mwAllPages();
}
