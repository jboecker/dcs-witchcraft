app.factory('model', ['socket', '$rootScope', '$q', function(socket, $rootScope, $q) {
    $rootScope.objects = {};
    $rootScope.visible_units = [];
    
    socket.on('update', function(changes) {
        (changes.deleted_object_ids || []).forEach(function(id) {
            var obj = $rootScope.objects[id];
            $rootScope.$emit('delete-object', obj);
            delete $rootScope.objects[id];
            $rootScope.$emit('deleted-object', obj);
        });
        
        Object.keys(changes.objects || []).forEach(function(id) {
            var obj = changes.objects[id];
            var is_new = ($rootScope.objects[id] === undefined);
            $rootScope.objects[obj.id] = obj;
            if (is_new) $rootScope.$broadcast('new-object', obj);
        });
    });
    
    socket.on('update-visible-units-set', function(visible_ids) {
        $rootScope.visible_units = visible_ids;
    });
    
    socket.emit("init");
    
    return {
        createEntry: function(name) {
            socket.emit('create-entry', name);
        }
    }
}]);
