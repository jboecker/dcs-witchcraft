witchcraft.factory('luashell', ['socket', '$q', function(socket, $q) {
	var deferredMap = {};
	
	socket.on("luaresult", function(result) {
		var d = deferredMap[result.name];
		if (d) {
			delete deferredMap[result.name];
			d.resolve(result);
		}
	});
    
    return {
        execute: function(code) {
			var d = $q.defer();
			var snippetName = Date.now().toString();
			deferredMap[snippetName] = d;
			socket.emit("lua", {name: snippetName, code: code});
			return d.promise;
        }
    }
}]);
