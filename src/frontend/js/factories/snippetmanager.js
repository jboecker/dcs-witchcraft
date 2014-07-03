app.factory('snippetManager', ['$rootScope', function($rootScope) {
	var nextId = 1;
	$rootScope.snippets = [];
	$rootScope.snippetManager = this;
	this.appendSnippet = function() {
		$rootScope.snippets.push({id: nextId});
		nextId += 1;
	};
	this.removeSnippet = function(id) {
		$rootScope.snippets = _.filter($rootScope.snippets, function(sn) { return sn.id != id });
	};
	return this;
}]);
