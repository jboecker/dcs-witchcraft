witchcraft.factory('luashell', ['socket', '$q', function(socket, $q) {
	var deferredMap = {};
	
	socket.on("luaresult", function(result) {
		var d = deferredMap[result.name];
		if (d) {
			delete deferredMap[result.name];
			d.resolve(result);
		}
	});
    
    var ret = {
        execute: function(code, arg) {
			var d = $q.defer();
			var snippetName = Date.now().toString();
			deferredMap[snippetName] = d;
			socket.emit("lua", {name: snippetName, code: code, arg: arg});
			return d.promise;
        }
    };
	window.dbg.luashell = ret;
	return ret;
}]);
