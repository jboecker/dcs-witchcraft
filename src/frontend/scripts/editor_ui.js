
witchcraft.run(["uistatetree", function(uistatetree) {
    var tool = uistatetree.toolStates.subState("move-tool")
    .enter(function() {
        uistatetree.getUIScope().activeTool = "move-tool";
    });
    uistatetree.registerTool("Move", tool);
}]);

witchcraft.run(["uistatetree", "socket", function(uistatetree, socket) {
    var tool = uistatetree.toolStates.subState("ping-tool", function(pingTool) {
        var interaction;
        
        pingTool.enter(function() {
            uistatetree.getUIScope().activeTool = "ping-tool";
            
            interaction = new witchcraft.MapBrowserEventProxy(function(event) {
				if (event.type == ol.MapBrowserEvent.EventType.DBLCLICK) {
					socket.emit('ping', event.coordinate);
				}
            });
            uistatetree.getMapController().getMap().addInteraction(interaction);
        });
        pingTool.exit(function() {
            uistatetree.getMapController().getMap().removeInteraction(interaction);
        });
    });
    uistatetree.registerTool("Ping", tool);
}]);

witchcraft.run(["uistatetree", "socket", function(uistatetree, socket) {
    var tool = uistatetree.toolStates.subState("clipmap-tool", function(clipmapTool) {
        var oldVis;
        clipmapTool.enter(function() {
            uistatetree.getUIScope().activeTool = "clipmap-tool";
            oldVis = uistatetree.getUIScope().visibleObjectTypes;
            uistatetree.getUIScope().visibleObjectTypes = ["cliparea"];
        });
        clipmapTool.exit(function() {
            uistatetree.getUIScope().visibleObjectTypes = oldVis;
        });
    });
    uistatetree.registerTool("Define Visible Area", tool);
    
    tool.subState("clipmap-tool/add", function(addState) {
        addState.defaultState();
        
        var interaction;
        var featureOverlay;
        var map;
        
        addState.enter(function() {
            map = uistatetree.getMapController().getMap();
            featureOverlay = uistatetree.getMapController().makeFeatureOverlay();
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
            map = uistatetree.getMapController().getMap();
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

witchcraft.run(["uistatetree", "socket", function(uistatetree, socket) {
    var tool = uistatetree.toolStates.subState("smoke-tool", function(smokeTool) {
        var interaction;
        uistatetree.getUIScope().smokeColor = "Green";
        
        smokeTool.enter(function() {
            uistatetree.getUIScope().activeTool = "smoke-tool";
            
            interaction = new witchcraft.MapBrowserEventProxy(function(event) {
                socket.emit('smoke', {
                    lon: event.coordinate[0],
                    lat: event.coordinate[1],
                    color: uistatetree.getUIScope().smokeColor,
                });
            });
            uistatetree.getMapController().getMap().addInteraction(interaction);
        });
        smokeTool.exit(function() {
            uistatetree.getMapController().getMap().removeInteraction(interaction);
        });
    });
    uistatetree.registerTool("Smoke", tool);
}]);


witchcraft.run(["uistatetree", "socket", "$rootScope", function(uistatetree, socket, $rootScope) {
    var tool = uistatetree.toolStates.subState("follow-tool", function(followTool) {
        var interaction;
        var map;
        var intervalHandle;
        var followId = null;
        
        followTool.enter(function() {
            followId = null;
            uistatetree.getUIScope().activeTool = "follow-tool";
            
            interaction = new ol.interaction.Select();
            map = uistatetree.getMapController().getMap();
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
            uistatetree.getMapController().getMap().removeInteraction(interaction);
        });
    });
    uistatetree.registerTool("Follow", tool);
}]);

witchcraft.run(["uistatetree", "luashell", function(uistatetree, luashell) {
    var tool = uistatetree.toolStates.subState("lua-interaction-tool", function(luaInteractionTool) {
        var interaction;
        var ui = uistatetree.getUIScope()
		var lastMoveEventTime = Date.now()
		var lastMoveX = null;
		var lastMoveZ = null;
		
        luaInteractionTool.enter(function() {
            uistatetree.getUIScope().activeTool = "lua-interaction-tool";
            
            interaction = new witchcraft.MapBrowserEventProxy(function(event) {
				var clickedUnitName = "nil";
				var map = uistatetree.getMapController().getMap();
				var pixel = map.getEventPixel(event.originalEvent);
				map.forEachFeatureAtPixel(event.pixel, function(feature, layer) {
					if (feature.get("object_type") == "liveunit")
						clickedUnitName = '"'+feature.get("object_id").substr(9)+'"';
				});
				var dcs_zx = ol.proj.transform(event.coordinate, "EPSG:4326", "DCS");
				var cmd2 = null;
                var cmd = 'local __x = '+dcs_zx[1]+'\n' +
						  'local __z = '+dcs_zx[0]+'\n' + 
						  'local __y = land.getHeight({ x = __x, y = __z })\n' + 
						  'local event = { vec2 = { x = __x, y = __z }, vec3 = { x = __x, y = __y, z = __z }, clickedUnitName = '+clickedUnitName+' }\n';
						  
				if (event.type == ol.MapBrowserEvent.EventType.CLICK)
						  cmd2 = 'if witchcraft.onClick then return witchcraft.onClick(event) end\n';
				if (event.type == ol.MapBrowserEvent.EventType.SINGLECLICK)
						  cmd2 = 'if witchcraft.onSingleClick then return witchcraft.onSingleClick(event) end\n';
				if (event.type == ol.MapBrowserEvent.EventType.DBLCLICK)
						  cmd2 = 'if witchcraft.onDblClick then return witchcraft.onDblClick(event) end\n';
				if (event.type == ol.MapBrowserEvent.EventType.POINTERMOVE) {
					if (Date.now() - lastMoveEventTime > 100) {
						if (dcs_zx[1] != lastMoveX && dcs_zx[0] != lastMoveZ) {
							cmd2 = 'if witchcraft.onMove then return witchcraft.onMove(event) end\n';
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
				
				luashell.execute(cmd+cmd2)
				.then(function(result) {
					//console.log(result);
				});
				
				return false;
            });
            uistatetree.getMapController().getMap().addInteraction(interaction);
        });
        luaInteractionTool.exit(function() {
            uistatetree.getMapController().getMap().removeInteraction(interaction);
        });
    });
    uistatetree.registerTool("Lua Interaction", tool);
}]);


witchcraft.run(["uistatetree", "model", function(uistatetree, model) {
    var tool = uistatetree.toolStates.subState("move-unit-tool", function(moveUnitTool) {
        var interaction;
        var ui = uistatetree.getUIScope()
		var lastMoveEventTime = Date.now()
		var lastMoveX = null;
		var lastMoveZ = null;
		var draggedUnitId = null;
		
        moveUnitTool.enter(function() {
			window.dbg.model = model;
            uistatetree.getUIScope().activeTool = "move-unit-tool";
            
            interaction = new ol.witchcraft.MapBrowserEventProxy(function(event) {
				var hoveredUnitId = null;
				var hoveredGroup = null;
				var map = uistatetree.getMapController().getMap();
				var pixel = map.getEventPixel(event.originalEvent);
				map.forEachFeatureAtPixel(event.pixel, function(feature, layer) {
					if (feature.get("object_type") == "liveunit") {
						hoveredUnitId = feature.get("unitId");
						if (hoveredUnitId) {
							hoveredGroup = model.getMissionModel().findGroupByUnitId(hoveredUnitId);
						}
					}
				});
				var dcs_zx = ol.proj.transform(event.coordinate, "EPSG:4326", "DCS");
				var swallowEvent = false;
				
				if (event.type == ol.MapBrowserEvent.EventType.CLICK) {
					if (!draggedUnitId && hoveredUnitId) {
						draggedUnitId = hoveredUnitId;
					} else {
						draggedUnitId = null;
					};
				};
				
				if (draggedUnitId) {
					var modified = false;
					
					var draggedGroup = model.getMissionModel().findGroupByUnitId(draggedUnitId);
					var groupCopy = JSON.parse(JSON.stringify(draggedGroup));
					
					_.each(groupCopy.units, function(unit) {
						if (unit.unitId == draggedUnitId) {
							if (unit.x != dcs_zx[1] || unit.y != dcs_zx[0]) {
								unit.x = dcs_zx[1];
								unit.y = dcs_zx[0];
								modified = true;
							}
							if (event.type == goog.events.MouseWheelHandler.EventType.MOUSEWHEEL) {
								if (event.browserEvent.deltaY < 0) {
									unit.heading += Math.PI/16;
								} else {
									unit.heading -= Math.PI/16;
								}
								modified = true;
								event.preventDefault();
								swallowEvent = true;
							}
						}
					}, this);
					if (modified && (Date.now() - lastMoveEventTime) > 0) {
						lastMoveEventTime = Date.now();
						model.changeMissionModel({ type: "setGroup", group: groupCopy });
					}
				};
				
				/*				
				if (event.type == ol.MapBrowserEvent.EventType.CLICK)
						  cmd2 = 'if witchcraft.onClick then return witchcraft.onClick(event) end\n';
				if (event.type == ol.MapBrowserEvent.EventType.SINGLECLICK)
						  cmd2 = 'if witchcraft.onSingleClick then return witchcraft.onSingleClick(event) end\n';
				if (event.type == ol.MapBrowserEvent.EventType.DBLCLICK)
						  cmd2 = 'if witchcraft.onDblClick then return witchcraft.onDblClick(event) end\n';
				if (event.type == ol.MapBrowserEvent.EventType.POINTERMOVE) {
					if (Date.now() - lastMoveEventTime > 100) {
						if (dcs_zx[1] != lastMoveX && dcs_zx[0] != lastMoveZ) {
							cmd2 = 'if witchcraft.onMove then return witchcraft.onMove(event) end\n';
							lastMoveEventTime = Date.now()
							lastMoveX = dcs_zx[1]; lastMoveZ = dcs_zx[0];
						}
					}
				}
				if (event.type == goog.events.MouseWheelHandler.EventType.MOUSEWHEEL) {
					cmd += 'event.deltaY = '+event.browserEvent.deltaY.toString()+'\n';
					cmd2 = 'if witchcraft.onMousewheel then witchcraft.onMousewheel(event) end\n';
				}
				*/
				
				return !swallowEvent;
            });
            uistatetree.getMapController().getMap().addInteraction(interaction);
        });
        moveUnitTool.exit(function() {
            uistatetree.getMapController().getMap().removeInteraction(interaction);
        });
    });
    uistatetree.registerTool("Move Unit", tool);
}]);

witchcraft.run(["uistatetree", "model", "luashell", "$modal", function(uistatetree, model, luashell, $modal) {
	var ui = uistatetree.getUIScope();
	ui.loadMissionFromDCS = function() {
		luashell.execute("return witchcraft.luaMissionToJSONable(env.mission)")
		.then(function(result) {
			var mission = result.result;
			model.changeMissionModel({type: "loadMission", mission: mission});
		});
	};
	
	zip.useWebWorkers = false;
	var zipfs = new zip.fs.FS();
	
	ui.saveMissionDialog = function() {
		$modal.open({
			templateUrl: '/templates/saveMissionDialog.html',
			size: 'sm',
			controller: function($scope, $modalInstance) {
				$scope.ok = function() {
					var file = document.getElementById("baseMissionFileInput").files[0];
					if (!file) {
						return;
					}
					
					var set_status = function(st) {
						$scope.status = st;
					};
					var filename = file.name;
					
					set_status("extracting mission...");
					zipfs.importBlob(file, function() {
						zipfs.find("mission").getText(function(luaCode) {
							set_status("loading mission...");
							
							zipfs.importBlob(file, function() {
								zipfs.remove(zipfs.find("mission"));
								
								set_status("creating new mission...");
								luashell.execute('return mist.utils.serialize("mission", witchcraft.JSONableMissionToLua(witchcraft.context.arg))', model.getMissionModel().toMission())
								.then(function(result) {
									var mission_str = result.result;
									set_status("saving mission...");

									zipfs.root.addText("mission", mission_str);
									
									set_status("initiating download...");
									zipfs.exportBlob(function(blob) {
										saveAs(blob, "mission.miz");
										$modalInstance.dismiss('ok');
									});
									
								});
							});
								
						},
						null,
						true,
						"utf-8");
					});
				};
				$scope.cancel = function() {
					$modalInstance.dismiss('cancel');
				};
			},
		});
	};
	
    var tool = uistatetree.toolStates.subState("file-menu-tool", function(fileTool) {
        fileTool.enter(function() {

            uistatetree.getUIScope().activeTool = "file-menu-tool";
        });
    });
    uistatetree.registerTool("File", tool);
}]);