witchcraft.directive('witchcraftLuasnippet', ['luashell', function(luashell) {
	return {
		restrict: 'A',
		scope: {
			snippet: '=',
			templates: '=',
		},
		require: '?^witchcraftLuasnippetlist',
		templateUrl: '/templates/luasnippet.html',
		link: function(scope, element, attrs, snippetlist) {
			scope.snippetlist = snippetlist;
			scope.status_text = "";
			scope.status = "info";
			scope.disable_input_scrollbars = false;
			scope.disable_output_scrollbars = false;
			
			element.addClass("luasnippet");
			
			
			var updateEditorSize = function(editor, disable_scrollbars) {
				var cm = editor.getWrapperElement();
				if (disable_scrollbars) {
					$(cm).css("height", "auto");
					$(cm).addClass("luasnippet-codemirror-noscrollbars");
				} else {
					$(cm).removeClass("luasnippet-codemirror-noscrollbars");
					var oldHeight = cm.style.height;
					var len = Math.min(editor.lineCount(), 20);
					var newHeight = (len+1).toString()+"em";
					if (oldHeight != newHeight) {
						$(cm).css("height", newHeight);
					}
				};
			};
			
			var inputEditorContainer = $(".luasnippet-input", element);
			var editor = CodeMirror(inputEditorContainer[0],
				{
					mode: "lua",
					theme: "neat",
					lineNumbers: true,
					indentUnit: 4,
					styleActiveLine: false,
					autofocus: true,
				});
			scope.$watch('snippet.code', function(value) {
				editor.setValue(value);
			});
			scope.$watch('disable_input_scrollbars', function() { updateEditorSize(editor, scope.disable_input_scrollbars); });
			updateEditorSize(editor, scope.disable_input_scrollbars);
			
			var highlightedErrorLineHandle = null;
			var highlightErrorLine = function(line) {
				if (highlightedErrorLineHandle)
					editor.getDoc().removeLineClass(highlightedErrorLineHandle, "background", "bg-danger");
				if (line !== null)
					highlightedErrorLineHandle = editor.getDoc().addLineClass(line, "background", "bg-danger");
			}
			
			editor.on("change", function(cm) {
				updateEditorSize(cm, scope.disable_input_scrollbars);
				highlightErrorLine(null);
				scope.snippet.input = editor.getValue();
			});
			editor.on("gutterClick", function(e) { scope.disable_input_scrollbars = !scope.disable_input_scrollbars; scope.$apply(); });
			
			var outputDiv = $(".luasnippet-output", element);
			var outputHeader = $(".luasnippet-status", element);
			
			scope.templateClicked = function(template) {
				scope.disable_input_scrollbars = false;
				editor.setValue(template.code);
				editor.focus();
			};
			
			var outputEditorContainer = $(".luasnippet-output", element);
			
			var outputEditor = CodeMirror(outputEditorContainer[0],
				{
					readOnly: true,
					lineNumbers: true,
				});
			scope.$watch('snippet.output', function(value) {
				outputEditor.setValue(value);
			});
			scope.$watch('disable_output_scrollbars', function() { updateEditorSize(outputEditor, scope.disable_output_scrollbars); });
			updateEditorSize(outputEditor, scope.disable_output_scrollbars);
			
			setTimeout(function(){outputEditor.refresh();}, 0);
			outputEditor.on("change", function(cm) {
				updateEditorSize(cm, scope.disable_input_scrollbars);
				outputEditor.refresh();
			});
			outputEditor.on("gutterClick", function(e) { scope.disable_output_scrollbars = !scope.disable_output_scrollbars; scope.$apply(); });
			scope.status_text = "Ctrl+Enter to evaluate, Shift+Enter to evaluate and start a new snippet";
			scope.status = "info";
			outputHeader.addClass("bg-info");

			window.dbg.editor = editor;
			
			var execSnippet = function() {
				scope.status_text = "waiting for result...";
				scope.status = "waiting";
				outputHeader.removeClass("bg-info bg-success bg-danger");
				outputHeader.addClass("bg-info");
				
				return luashell.execute(editor.getValue())
				.then(function(result) {
					outputHeader.removeClass("bg-info bg-success bg-danger");
					scope.disable_output_scrollbars = false;
					scope.output = "";
					if (result.success) {
						scope.status_text = (typeof result.result).toString();
						scope.status = "success";
						if (result.result === undefined) {
							scope.snippet.output = "nil";
							scope.status_text = "nil";
							scope.status = "success";
						} else if (typeof result.result === "string") {
							scope.snippet.output = result.result;
						} else {
							scope.snippet.output = JSON.stringify(result.result, undefined, 4);
						}
						outputHeader.addClass("bg-success");
					} else {
						scope.status_text = result.result;
						scope.status = "error";
						outputHeader.addClass("bg-danger");
						scope.snippet.output = "";
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
					return result;
				});
			};
			
			editor.addKeyMap({
				"Shift-Enter": function(cm) {
					scope.$apply(function() {
						if (snippetlist) snippetlist.appendSnippet();
						execSnippet();
					});
				},
				"Ctrl-Enter": function(cm) {
					scope.$apply(function() {
						execSnippet();
					});
				},
			});
		},
	};
}]);
