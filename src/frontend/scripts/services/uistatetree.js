witchcraft.factory('uistatetree', ['$rootScope', 'socket', 'model', 'luashell', function($rootScope, socket, model, luashell) {
    var tree = window.makeStateTree();
    
    var uiScope = $rootScope.$new(true);
    window.dbg = window.dbg || {}
    window.dbg.uiScope = uiScope;
    window.dbg.rootScope = $rootScope;
    $rootScope.ui = uiScope;
    uiScope.displayedPopup = null;
    uiScope.stateFromName = tree.stateFromName;
    uiScope.availableTools = [];
    uiScope.activeTool = null;

    uiScope.isStateActive = function(name) {
        return tree.stateFromName(name).isActive();
    };
    uiScope.gotoState = function(name) {
        tree.stateFromName(name).goTo();
    };
    this.getUIScope = function() { return uiScope; };
	
    var mapController = null;
    this.setMapController = function(mc) { mapController = mc; };
    this.getMapController = function() { return mapController; };

    var haveMap = tree.root.subState("haveMap")
        .concurrentSubStates()
        .enter(function() {
            mapController.init();
            
            socket.on("liveupdate", function(data) {
                console.log("live update", data);
            });
            socket.on("ping", function(coordinate) {
                mapController.pingLocation({
                    coordinate: coordinate,
                });
            });
            socket.on("smokeconfirm", function(args) {
                mapController.pingLocation({
                    coordinate: [args.lon, args.lat],
                    rgb: "0,255,0",
                    maxRadius: 30,
                });
            });
        });
    
    haveMap.subState("uiMajorMode", function(uiMajorMode) {        
        uiMajorMode.subState("mapView")
        .defaultState()
        .enter(function() {
            uiScope.clipboxes = null;
            uiScope.toolStates["file-menu-tool"].goTo();
        });
    });
    
    this.toolStates = haveMap.subState("toolStates");
    uiScope.toolStates = {}
    uiScope.toolDisplayNames = {}
    this.registerTool = function(displayName, state) {
        uiScope.toolDisplayNames[state.name] = displayName;
        uiScope.toolStates[state.name] = state;
    };

    return this;
}]);


