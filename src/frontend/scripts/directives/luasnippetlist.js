witchcraft.directive('witchcraftLuasnippetlist', ['luaTemplateRegistry', function(luaTemplateRegistry) {
	return {
		restrict: 'A',
		scope: {},
		templateUrl: '/templates/luasnippetlist.html',
		controller: function($scope) {
			var nextId = 2;
			$scope.templates = luaTemplateRegistry.getTemplates();
			this.appendSnippet = function() {
				$scope.snippets.push({
					id: nextId++,
					code: "",
					output: "",
				});
			};
			this.removeSnippet = function(id) {
				$scope.snippets = _.filter($scope.snippets, function(sn) { return sn.id != id });
			};
			$scope.snippets = [];
			this.appendSnippet();
			
			$scope.appendSnippet = this.appendSnippet;
			$scope.removeSnippet = this.removeSnippet;
		},
	};
}]);
