app.factory('uistate', ['$rootScope', 'socket', function($rootScope, socket) {
    var tree = window.makeStateTree();
    
    var uiScope = $rootScope.$new(true);
    window.dbg = {}
    window.dbg.uiScope = uiScope;
    window.dbg.rootScope = $rootScope;
    $rootScope.ui = uiScope;
    uiScope.displayedPopup = null;
    uiScope.stateFromName = tree.stateFromName;
    uiScope.clipboxes = [];
    uiScope.availableTools = [];
    uiScope.activeTool = null;
    uiScope.visibleObjectTypes = ["liveunit", "building", "trackingedge"];
    uiScope.showFriendlyTrackingEdges = true;
    uiScope.showHostileTrackingEdges = false;
    
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
    
    var greeting = tree.root.subState("greeting")
        .enter(function() {
            uiScope.displayedPopup = "greeting";
        })
        .exit(function() {
            uiScope.displayedPopup = null;
        });
    
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
            uiScope.availableTools = ["move-tool", "ping-tool", "smoke-tool", "follow-tool", "lua-interaction-tool"];
            uiScope.toolStates["move-tool"].goTo();
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

goog.provide("app.DoubleClickInteraction");
goog.require("ol.MapBrowserEvent");
goog.require("ol.MapBrowserEvent.EventType");
goog.require("ol.interaction.Interaction");
app.DoubleClickInteraction = function(callback) {
    goog.base(this);
    this.callback_ = callback;
};
goog.inherits(app.DoubleClickInteraction, ol.interaction.Interaction);

app.DoubleClickInteraction.prototype.handleMapBrowserEvent = function(mapBrowserEvent) {
    if (mapBrowserEvent.type == ol.MapBrowserEvent.EventType.DBLCLICK) {
        this.callback_(mapBrowserEvent);
        return false;
    };
    return true;
};

app.run(["uistate", function(uistate) {
    var tool = uistate.toolStates.subState("move-tool")
    .enter(function() {
        uistate.getUIScope().activeTool = "move-tool";
    });
    uistate.registerTool("Move", tool);
}]);

app.run(["uistate", "socket", function(uistate, socket) {
    var tool = uistate.toolStates.subState("ping-tool", function(pingTool) {
        var interaction;
        
        pingTool.enter(function() {
            uistate.getUIScope().activeTool = "ping-tool";
            
            interaction = new app.DoubleClickInteraction(function(event) {
                socket.emit('ping', event.coordinate);
            });
            uistate.getMapController().getMap().addInteraction(interaction);
        });
        pingTool.exit(function() {
            uistate.getMapController().getMap().removeInteraction(interaction);
        });
    });
    uistate.registerTool("Ping", tool);
}]);

app.run(["uistate", "socket", function(uistate, socket) {
    var tool = uistate.toolStates.subState("clipmap-tool", function(clipmapTool) {
        var oldVis;
        clipmapTool.enter(function() {
            uistate.getUIScope().activeTool = "clipmap-tool";
            oldVis = uistate.getUIScope().visibleObjectTypes;
            uistate.getUIScope().visibleObjectTypes = ["cliparea"];
        });
        clipmapTool.exit(function() {
            uistate.getUIScope().visibleObjectTypes = oldVis;
        });
    });
    uistate.registerTool("Define Visible Area", tool);
    
    tool.subState("clipmap-tool/add", function(addState) {
        addState.defaultState();
        
        var interaction;
        var featureOverlay;
        var map;
        
        addState.enter(function() {
            map = uistate.getMapController().getMap();
            featureOverlay = uistate.getMapController().makeFeatureOverlay();
            interaction = new ol.interaction.Draw({
                features: featureOverlay.getFeatures(),
                type: "Polygon"
            });
            interaction.on("drawend", function(event) {
                featureOverlay.removeFeature(event.feature);
                socket.emit("create-cliparea", event.feature.get("geometry").getCoordinates());
            });
            map.addInteraction(interaction);
        });
        addState.exit(function() {
            map.removeInteraction(interaction);
            featureOverlay.setMap(null);
        });
    });        

    tool.subState("clipmap-tool/delete", function(delState) {
        
        var interaction;
        var map;
        
        delState.enter(function() {
            interaction = new ol.interaction.Select();
            map = uistate.getMapController().getMap();
            map.addInteraction(interaction);
            
            interaction.getFeatures().on("add", function(event) {
                socket.emit("delete-object", event.element.get("object_id"));
                interaction.getFeatures().remove(event.element);
            });
        });
        delState.exit(function() {
            map.removeInteraction(interaction);
        });
    });

}]);

app.run(["uistate", "socket", function(uistate, socket) {
    var tool = uistate.toolStates.subState("smoke-tool", function(smokeTool) {
        var interaction;
        uistate.getUIScope().smokeColor = "Green";
        
        smokeTool.enter(function() {
            uistate.getUIScope().activeTool = "smoke-tool";
            
            interaction = new app.DoubleClickInteraction(function(event) {
                socket.emit('smoke', {
                    lon: event.coordinate[0],
                    lat: event.coordinate[1],
                    color: uistate.getUIScope().smokeColor,
                });
            });
            uistate.getMapController().getMap().addInteraction(interaction);
        });
        smokeTool.exit(function() {
            uistate.getMapController().getMap().removeInteraction(interaction);
        });
    });
    uistate.registerTool("Smoke", tool);
}]);


app.run(["uistate", "socket", "$rootScope", function(uistate, socket, $rootScope) {
    var tool = uistate.toolStates.subState("follow-tool", function(followTool) {
        var interaction;
        var map;
        var intervalHandle;
        var followId = null;
        
        followTool.enter(function() {
            followId = null;
            uistate.getUIScope().activeTool = "follow-tool";
            
            interaction = new ol.interaction.Select();
            map = uistate.getMapController().getMap();
            map.addInteraction(interaction);
            
            interaction.getFeatures().on("add", function(event) {
                followId = event.element.get("object_id");
                interaction.getFeatures().remove(event.element);
            });
            
            intervalHandle = window.setInterval(function() {
                if (followId) {
                    var obj = $rootScope.objects[followId];
                    if (obj) {
                        map.getView().setCenter(ol.proj.transform([obj.pos.p.z, obj.pos.p.x], "DCS", "EPSG:4326"));
                        //var x = ol.proj.transform([obj.pos.x.z, obj.pos.x.x], "DCS", "EPSG:4326");
                        //map.getView().setRotation(-Math.atan2(obj.pos.x.z, obj.pos.x.x));
                    }
                }
            }, 10);
        });
        
        followTool.exit(function() {
            if (intervalHandle) window.clearInterval(intervalHandle);
            uistate.getMapController().getMap().removeInteraction(interaction);
        });
    });
    uistate.registerTool("Follow", tool);
}]);


goog.provide("app.MapBrowserEventProxy");
goog.require("ol.MapBrowserEvent");
goog.require("ol.MapBrowserEvent.EventType");
goog.require("ol.interaction.Interaction");
app.MapBrowserEventProxy = function(callback) {
    goog.base(this);
    this.callback_ = callback;
};
goog.inherits(app.MapBrowserEventProxy, ol.interaction.Interaction);

app.MapBrowserEventProxy.prototype.handleMapBrowserEvent = function(mapBrowserEvent) {
	try {
		return this.callback_(mapBrowserEvent);
	} catch(e) {
		console.log(e);
		return true;
	}
	/*
    if (mapBrowserEvent.type == ol.MapBrowserEvent.EventType.DBLCLICK) {
        this.callback_(mapBrowserEvent);
        return false;
    };
    return true;
	*/
};
app.run(["uistate", "luashell", function(uistate, luashell) {
    var tool = uistate.toolStates.subState("lua-interaction-tool", function(luaInteractionTool) {
        var interaction;
        var ui = uistate.getUIScope()
		var lastMoveEventTime = Date.now()
		var lastMoveX = null;
		var lastMoveZ = null;
		
        luaInteractionTool.enter(function() {
            uistate.getUIScope().activeTool = "lua-interaction-tool";
            
            interaction = new app.MapBrowserEventProxy(function(event) {
				var dcs_zx = ol.proj.transform(event.coordinate, "EPSG:4326", "DCS");
				var cmd2 = null;
                var cmd = 'local __x = '+dcs_zx[1]+'\n' +
						  'local __z = '+dcs_zx[0]+'\n' + 
						  'local __y = land.getHeight({ x = __x, y = __z })\n' + 
						  'local event = { vec2 = { x = __x, y = __z }, vec3 = { x = __x, y = __y, z = __z } }\n';
				if (event.type == ol.MapBrowserEvent.EventType.CLICK)
						  cmd2 = 'if witchcraft.onClick then witchcraft.onClick(event) end\n';
				if (event.type == ol.MapBrowserEvent.EventType.SINGLECLICK)
						  cmd2 = 'if witchcraft.onSingleClick then witchcraft.onSingleClick(event) end\n';
				if (event.type == ol.MapBrowserEvent.EventType.DBLCLICK)
						  cmd2 = 'if witchcraft.onDblClick then witchcraft.onDblClick(event) end\n';
				if (event.type == ol.MapBrowserEvent.EventType.POINTERMOVE) {
					if (Date.now() - lastMoveEventTime > 100) {
						if (dcs_zx[1] != lastMoveX && dcs_zx[0] != lastMoveZ) {
							cmd2 = 'if witchcraft.onMove then witchcraft.onMove(event) end\n';
							lastMoveEventTime = Date.now()
							lastMoveX = dcs_zx[1]; lastMoveZ = dcs_zx[0];
						}
					}
				}
				if (event.type == goog.events.MouseWheelHandler.EventType.MOUSEWHEEL) {
					cmd += 'event.deltaY = '+event.browserEvent.deltaY.toString()+'\n';
					cmd2 = 'if witchcraft.onMousewheel then witchcraft.onMousewheel(event) end\n';
				}
				if (!cmd2) return true;
				
				console.log(cmd2);
				luashell.execute(cmd+cmd2)
				.then(function(result) {
					console.log(result);
				});
				
				return false;
            });
            uistate.getMapController().getMap().addInteraction(interaction);
        });
        luaInteractionTool.exit(function() {
            uistate.getMapController().getMap().removeInteraction(interaction);
        });
    });
    uistate.registerTool("Lua Interaction", tool);
}]);