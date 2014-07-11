witchcraft.factory('model', ['socket', '$q', function(socket, $q) {
    var missionModel = new MissionModel({
		mode: "client",
	});
    
	socket.on('missionModelChange', function(changes) {
		changes, missionModel.processChangeRequest(changes);
	});
	
    socket.emit("init");
    
    return {
        getMissionModel: function() {
			return missionModel;
		},
		changeMissionModel: function(changes) {
			socket.emit("requestMissionModelChange", changes);
		},
    }
}]);
