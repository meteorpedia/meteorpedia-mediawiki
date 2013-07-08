function loadPageSelector(selector) {
	if (0 && selector.name && selector.name.match(/:/)) {
		var name = selector.name.split(':', 2);
		selector.namespace = name[0].toLowerCase();
		selector.name = name[1];
		console.log(selector);
	}
	return selector;
}

function submitEdit(data) {
	if (data.page.name.match(/:/)) {
		var name = data.page.name.split(':', 2);
		data.page.namespace = name[0].toLowerCase();
		// data.page.name = name[1];
		console.log(data);
	}
	return data;
}

Extensions.add({
      	name: "mw-namespaces",
      	version: "0.1.0",
      	author: "Gadi Cohen <dragon@wastelands.net>",
      	description: "Adds support for namespaces, e.g. Category:This, Template:That",
      	hooks: {
      		'loadPageSelector': { api: '0.1.0', func: loadPageSelector },
      		'submitEdit': { api: '0.1.0', func: submitEdit }
      	}
	});    