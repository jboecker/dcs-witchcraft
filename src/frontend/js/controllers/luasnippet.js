app.controller('LuaSnippetController', ['$rootScope', '$compile', '$element', '$attrs', '$scope', 'luashell', 'snippetManager', function($rootScope, $compile, $element, $attrs, $scope, luashell, snippetManager) {
	$element.addClass("luasnippet");
	
	var myId = null;
	$scope.setId = function(id) { myId = id; };
	
	var editor = CodeMirror($element[0],
		{
			mode: "lua",
			theme: "neat",
			lineNumbers: true,
			indentUnit: 4,
			styleActiveLine: false,
			autofocus: true,
		});
	var highlightedErrorLineHandle = null;
	var highlightErrorLine = function(line) {
		if (highlightedErrorLineHandle)
			editor.getDoc().removeLineClass(highlightedErrorLineHandle, "background", "bg-danger");
		if (line !== null)
			highlightedErrorLineHandle = editor.getDoc().addLineClass(line, "background", "bg-danger");
	}
	
	editor.on("change", function() { highlightErrorLine(null); });
	
	var outputDiv = $("<div>").addClass("luaoutput");
	var outputHeader = $("<div>").appendTo(outputDiv);
	var statusText = $("<span>").appendTo(outputHeader);
	var controls = $("<span>")
		.addClass("luasnippet-controls")
		.appendTo(outputHeader);
	
	
	var templateDropdown = $('<span class="dropdown">')
	.appendTo(controls);
	$('<a href="#">')
	.text("template")
	.attr("data-toggle", "dropdown")
	.appendTo(templateDropdown)

	var templateDropdownList = $('<ul class="dropdown-menu pull-right">')
	.appendTo(templateDropdown);
	
	var st = $(document.getElementById("snippet-templates").children)
	st.each(function(idx, tpl_elem) {
		console.log(tpl_elem);
		var tpl = $(tpl_elem);
		var listitem = $('<li>')
		.appendTo(templateDropdownList);
		
		var link = $('<a href="#">')
		.text(tpl.attr("title"))
		.appendTo(listitem)
		.click(function() {
			editor.setValue(tpl.text());
			editor.focus();
		});
	});
	

	$("<span> </span>").appendTo(controls);
	$('<a href="#">').text("delete")
	.appendTo(controls)
	.click(function() {
		$rootScope.$apply(function() {
			snippetManager.removeSnippet(myId);
		});
	});

	var outputEditorContainer = $("<div>").appendTo(outputDiv);
	
	var outputEditor = CodeMirror(outputEditorContainer[0],
		{
			readOnly: true,
			lineNumbers: false,
			gutters: ["scrolltoggle-gutter"],
		});
	setTimeout(function(){outputEditor.refresh();}, 0);
	outputEditor.on("gutterClick", function(e) { outputEditorContainer.toggleClass("luaoutput-scrolling"); });
	$element.append(outputDiv);
	statusText.text("Ctrl+Enter to evaluate, Shift+Enter to evaluate and start a new snippet");
	outputHeader.addClass("bg-info");

	window.dbg.editor = editor;
	
	var execSnippet = function() {
		statusText.text("waiting for result...");
		outputHeader.removeClass("bg-info bg-success bg-danger");
		outputHeader.addClass("bg-info");
		
		return luashell.execute(editor.getValue())
		.then(function(result) {
			outputHeader.removeClass("bg-info bg-success bg-danger luaoutput-scrolling");
			if (result.success) {
				statusText.text((typeof result.result));
				if (result.result === undefined) {
					outputEditor.setValue("nil");
					statusText.text("nil");
				} else if (typeof result.result === "string") {
					outputEditor.setValue(result.result);
				} else {
					outputEditor.setValue(JSON.stringify(result.result, undefined, 4));
				}
				outputHeader.addClass("bg-success");
			} else {
				statusText.text(result.result);
				outputHeader.addClass("bg-danger");
				outputEditor.setValue("");
				var m = result.result.match(/^\[string "[A-Za-z0-9-]+"\]:(\d+):/);
				window.dbg.s = result.result;
				if (m) {
					var lineNumber = parseInt(m[1]);
					if (lineNumber) {
						editor.setCursor(lineNumber-1, 0);
						highlightErrorLine(lineNumber-1);
					}
				}
			}
			if (outputEditorContainer.height() > 200) {
				outputEditorContainer.addClass("luaoutput-scrolling");
			}
			return result;
		});
	};
	
	editor.addKeyMap({
		"Shift-Enter": function(cm) {
			$rootScope.$apply(function() {
				snippetManager.appendSnippet();
				execSnippet()
			});
		},
		"Ctrl-Enter": function(cm) {
			execSnippet();
		},
	});
}]);
