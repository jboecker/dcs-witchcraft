witchcraft.directive('witchcraftToolbar', ['uistatetree', function(uistatetree) {
	return {
		restrict: 'A',
		scope: {
		},
		templateUrl: '/templates/toolbar.html',
		link: function(scope, element, attrs, snippetlist) {
			scope.tools = attrs.tools.split(" ");
			scope.ui = uistatetree.getUIScope();
		},
	};
}]);
