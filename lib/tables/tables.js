// http://www.mediawiki.org/wiki/Help:Tables

Extensions.add({
	name: "mwTables",
	version: "0.1.0",
	author: "Gadi Cohen <dragon@wastelands.net>",
	description: "Mediawiki style tables, {| |} etc",
	hooks: {
		'mwClientRenderPreMD': { api: '0.1.0', func: mwTableRender }
	}
});

if (Meteor.isClient) {
	function mwTableRender(data) {
		// http://stackoverflow.com/questions/1068280/javascript-regex-multiline-flag-doesnt-work
		var re = /\{\|([\s\S]*?)\|\}/g;

		data.edit.contentParsed = data.edit.contentParsed.replace(re, function(match) {
			// This was ported by hand from Mediawiki's PHP table parser code
			// https://doc.wikimedia.org/mediawiki-core/master/php/html/Parser_8php_source.html
			var out = '';
			var lines = match.split('\n');
			var td_history = [];        // Is currently a td tag open?
			var last_tag_history = [];  // Save history of last lag activated (td, th or caption)
			var tr_history = [];        // Is currently a tr tag open?
			var tr_attributes = [];		// history of tr attributes
			var has_opened_tr = [];		// Did this table open a <tr> element?
			var indent_level = 0;		// indent level of the table
			var first_character;
			var matches;
			var attributes;
			var cells;
			var last_tag;
			var previous;
			var tr_after;
			var cell_data;

			for (var i=0, outLine=lines[0], line; i < lines.length; outLine=lines[++i]) {
				line = outLine.trim();

				if (line == '') {
					// empty line, go to next line
					out += outLine + '\n';
					continue;
				}

				first_character = line[0];
				var re = /^(:*)\{\|(.*)$/;
				matches = re.exec(line);
				
				if (matches) {

					// First check if we are starting a new table
					indent_level = matches[1].length;

					/* TODO
					$attributes = $this->mStripState->unstripBoth( $matches[2] );
					$attributes = Sanitizer::fixTagAttributes( $attributes, 'table' );
					*/
					attributes = matches[2].replace(/\&quot;/g, '"');

					outLine = str_repeat('<dl><dd>', indent_level) + "<table"+attributes+">";
					td_history.push(false);
					last_tag_history.push('');
					tr_history.push(false);
					tr_attributes.push('');
					has_opened_tr.push(false);

				} else if (td_history.length == 0) {

					// Don't do any of the following
					out += outLine + '\n';
					continue;

				} else if (line.substr(0,2) == '|}') {

					// We are ending a table
					line = '</table>' + line.substr(2);

					if (!has_opened_tr.pop())
						line = "<tr><td></td></tr>" + line;

					if (tr_history.pop())
						line = "</tr>" + line;

					if (td_history.pop())
						line = "</" + last_tag + ">" + line;

					tr_attributes.pop();
					outLine = line + str_repeat('</dd></dl>', indent_level);

				} else if (line.substr(0,2) == '|-') {

					// Now we have a table row
					line = line.replace(/^\|-+/, '');

					// What's after the tag is now only attributes
					/* TODO
					$attributes = $this->mStripState->unstripBoth( $line );
					$attributes = Sanitizer::fixTagAttributes( $attributes, 'tr' );
					*/
					attributes = line;
					tr_attributes.pop();
					tr_attributes.push(attributes);

					line = '';
					last_tag = last_tag_history.pop();
					has_opened_tr.pop();
					has_opened_tr.push(true);

					if (has_opened_tr.pop())
						line = '</tr>';

					if (td_history.pop())
						line = '</' + last_tag + '>' + line;

					outLine = line;
					tr_history.push(false);
					td_history.push(false);
					last_tag_history.push('');

				} else if (first_character == '|' || first_character == '!'
						|| line.substr(0,2) == '|+') {

					// This might be cell elements, td, th or captions
					if (line.substr(0,2) == '|+') {
						first_character = '+';
						line = line.substr(1);
					}

					line = line.substr(1);

					if (first_character == '!') {
						line = line.replace('!!', '||');
					}

					// Split up multiple cells on the same line.
					// FIXME : This can result in improper nesting of tags processed
					// by earlier parser steps, but should avoid splitting up eg
					// attribute values containing literal "||".
					// $cells = StringUtils::explodeMarkup( '||', $line );
					cells = line.split('||');

					outLine = '';

					// Loop through each table cell
					for (var j=0, cell=cells[0]; j < cells.length; cell=cells[++j]) {
						previous = '';
						if (first_character != '+') {
							tr_after = tr_attributes.pop();
							if (!tr_history.pop())
								previous = '<tr' + tr_after + '>\n';
							tr_history.push(true);
							tr_attributes.push('');
							has_opened_tr.pop();
							has_opened_tr.push(true);
						}

						last_tag = last_tag_history.pop();

						if (td_history.pop())
							previous = "</" + last_tag + '>\n' + previous;

						if (first_character == '|')
							last_tag = 'td';
						else if (first_character == '!')
							last_tag = 'th';
						else if (first_character == '+')
							last_tag = 'caption';
						else
							last_tag = '';

						last_tag_history.push(last_tag);

						// A cell could contain both parameters and data
						cell_data = cell.split('|', 2);

						// Bug 553: Note that a '|' inside an invalid link should not
						// be mistaken as deliminting cell parameters
						if (cell_data[0].match(/\[\[/)) {
							cell = previous + '<' + last_tag + '>' + cell;
						} else if (cell_data.length == 1) {
							cell = previous + '<' + last_tag + '>' + cell_data[0];
						} else {
							/*
							$attributes = $this->mStripState->unstripBoth( $cell_data[0] );
							$attributes = Sanitizer::fixTagAttributes( $attributes, $last_tag
							*/
							attributes = cell_data[0];
							cell = previous + '<' + last_tag + attributes + '>' + cell_data[1];
						}

						outLine += cell;
						td_history.push(true);

					}

				}

				out += outLine + '\n';

			} /* each line */

			// Closing open td, tr && table
			while (td_history.length > 0) {
				if (td_history.pop())
					out += "</td>\n";
				if (tr_history.pop())
					out += "</tr>\n";
				if (!has_opened_tr.pop())
					out += "<tr><td></td></tr>\n";

				out += "</table>\n";
			}

			// Remove trailing line-ending (b/c)
			if (out.substr(-1) == '\n')
				out = out.substr(0, out.length-1);

			// special case: don't return empty table
			if (out == "<table>\n<tr><td></td></tr>\n</table>")
				out = '';

			return out;
		});

		return data;
	}

	// http://phpjs.org/functions/str_repeat/
	function str_repeat (input, multiplier) {
	  // http://kevin.vanzonneveld.net
	  // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	  // +   improved by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
	  // +   improved by: Ian Carter (http://euona.com/)
	  // *     example 1: str_repeat('-=', 10);
	  // *     returns 1: '-=-=-=-=-=-=-=-=-=-='

	  var y = '';
	  while (true) {
	    if (multiplier & 1) {
	      y += input;
	    }
	    multiplier >>= 1;
	    if (multiplier) {
	      input += input;
	    }
	    else {
	      break;
	    }
	  }
	  return y;
	}
}