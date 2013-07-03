if (Meteor.isClient) {
	Meteor.startup(function() {
		var oldRendered = Template.edit.rendered;
		Template.edit.rendered = function() {
			if (oldRendered)
				oldRendered();
			var editContents = $('#edit-contents');
			if (!editContents.data('mwWrappped')) {
				//Session.set('currentTab', '#editSource');
				editContents.data('mrWrapped', true);

				// wrap the original textarea with tabs
				editContents
					.wrap('<div class="tab-content"></div>')
					.wrap('<div class="tab-pane active" id="editSource"></div>');
				$('.tab-content').before(
					  '<ul class="nav nav-tabs" id="editTabs">'
					+ '	<li class="active"><a href="#editSource">Source</a></li>'
					+ '	<li class><a href="#editPreview">Preview</a></li>'
					+ '</ul>'
				);
				$('#editSource').after(
					'<div class="tab-pane uneditable-input span11" id="editPreview">Preparing...</div>'
				);

				// tab javascript
				$('#editTabs a').click(function(e) {
					var $this = $(this);
					e.preventDefault();
					$this.tab('show');
					Session.set('currentTab', $this.attr('href'));
				});

				$('#editTabs a[href="#editSource"]').on('shown', function(e) {
					$('.edit .pull-right').css('display', 'block');
					$('.edit .span11').removeClass('span11').addClass('span8');
					$('#editPreview').html('Preparing...');
				});
				$('#editTabs a[href="#editPreview"]').on('shown', function(e) {
					$('.edit .pull-right').css('display', 'none');
					$('.edit .span8').removeClass('span8').addClass('span11');
					var data = {
						_id: pageId(),
						name: pageName(),
						content: $('#edit-contents').val()
					};
					Meteor.call('mwPreview', data, function(error, result) {
						console.log(result);
						/* result = { page: page, edit: edit } */
						result = Extensions.runHookChain('render', result);
						$('#editPreview').html(result.edit.formattedContent);
					});
				});

				var currentTab = Session.get('currentTab');
				if (currentTab)
					$('[href=' + currentTab + ']').tab('show');
			}
		}
	});

} else { /* isServer */

	Meteor.methods({
		mwPreview: function(data) {
			var page, edit;
			if (data._id) {
				page = WikiPages.findOne({_id: data._id});
				edit = WikiEdits.findOne({_id: page.lastEditId});
			} else {
				// Creating a new page, supply anything needed by hook funcs
				page = {
					name: data.name
				};
				edit = {

				};
			}

			edit.content = data.content;
			hookData = Extensions.runHookChain('submitEdit', {
				edit: edit,
				page: page,
				preview: true // don't manipulate any other documents!
			});
  			edit = hookData.edit; page = hookData.page;

			return { page: page, edit: edit };
		}
	});
}
