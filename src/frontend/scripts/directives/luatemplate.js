witchcraft.directive('witchcraftLuaTemplate', ['luaTemplateRegistry', function(luaTemplateRegistry) {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			var name = attrs.title;
			var code = $.trim(element.text());
			luaTemplateRegistry.addTemplate({
				name: name,
				code: code,
			});
			element.remove();
		},
	};
}]);
