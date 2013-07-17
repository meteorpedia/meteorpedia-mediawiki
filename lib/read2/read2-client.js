Extensions.add({
    name: "read2",
    version: "0.1.0",
    author: "Gadi Cohen <dragon@wastelands.net>",
    description: "Modified /read page with new features",
    hooks: {
      'activeViews': { api: '0.1.0', func: specialActiveViews },
    }
});    

Template.read2.catTrees = [
  {name: 'Category:Design_Patterns'},
  {name: 'Category:Development'},
  {name: 'Category:PaaS_providers'},
  {name: 'Category:People'}
];

Template.showPage.lastEdit = function() {
  var p, data;
  p = WikiPages.findOne(pageId());
  if (!p || !p.lastEditId) {
    return {};
  }
  data = { page: p, edit: WikiEdits.findOne(p.lastEditId) };
  return Extensions.runHookChain('render', data).edit;
};
Extensions.registerHookType('render', '1.0.0');

/**
 * @return {boolean}
 */
Template.showPage.hasFormattedContents = function() {
  var p, edit;
  p = WikiPages.findOne(pageId());
  if (!p || !p.lastEditId) {
    return false;
  }
  edit = WikiEdits.findOne(p.lastEditId);
  return edit ? !!edit.formattedContent : false;
};

/**
 * @return {string}
 */
Template.showPage.pageTitle = function() {
  return formattedPageName();
};

/**
 * @return {string}
 */
Template.showPage.pageName = function() {
  return pageName();
};

/**
 * @return {boolean}
 */
Template.showPage.pageExists = function() {
  var p;
  p = WikiPages.findOne({_id: pageId()});
  if (!p) {
    return false;
  }
  return !!WikiEdits.findOne({_id: p.lastEditId});
};

Template.read2.events({
  'click a.internal-link': function(event) {
    handleInternalClick(event);
  }
});

function specialActiveViews(activeViews) {
  /*
   * Note, you can't actually "rename" Templates, their name is compiled into them
   * at bundle time.  Here we just copy the template over before it's inserted into
   * ActiveViews, but helper functions will still be in the 'read2' namespace.
   *
   */
  Template.read = Template.read2;
  return activeViews;
}

x = Meteor.subscribe('topPages');

Template.topPages.topPages = function() {
    return WikiPages.find({readCount: {$exists: true}}, {
      fields: { name: 1, readCount: 1 },
      sort: { readCount: -1 },
      limit: 10
    }); 
}

Meteor.startup(function () {
  Deps.autorun(function() {
      var pageId = Session.get(SESSION_PAGE_ID);
      Meteor.call('readCountIncr', pageId);
  });
});