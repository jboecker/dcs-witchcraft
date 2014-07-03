app.controller('MapController', ['$rootScope', '$element', 'uistate', 'model', 'UNITDATA', function($rootScope, $element, uistate, model, UNITDATA) {
    uistate.setMapController(this);
    var uiScope = uistate.getUIScope();

    var map = null;
    var projection = ol.proj.get('EPSG:4326');
    var features_by_object_id = {};
    var vectorSource, vectorLayer;
    var dcsProjection = "+proj=tmerc +lat_0=0 +lon_0=33 +k_0=0.9996 +x_0=-99517 +y_0=-4998115";
    window.dbg.mapController = this;
    this.getDCSProjection = function() { return dcsProjection; };

    this.makeBuildingFeature = function(desc) {
        if (!desc.box) return null;
        var rot = goog.vec.Mat4.createNumber();
        ol.vec.Mat4.makeTransform2D(rot
                                    , desc.center.z // translateX1
                                    , desc.center.x // translateY1
                                    , 1 // scaleX,
                                    , 1 // scaleY,
                                    , -Math.atan2(desc.pos.x.z, desc.pos.x.x) //desc.heading - (Math.PI/4) // rotation,
                                    , 0 // translateX2,
                                    , 0  // translateY2
                                   );

        var coordsDCS = [[desc.box.min.z, desc.box.min.x],
                         [desc.box.max.z, desc.box.min.x],
                         [desc.box.max.z, desc.box.max.x],
                         [desc.box.min.z, desc.box.max.x]];

        var coordsLL = [];
        for (i=0; i<4; i++) {
            ol.vec.Mat4.multVec2(rot, coordsDCS[i], coordsDCS[i]);
            coordsLL.push(ol.proj.transform(coordsDCS[i], "DCS", "EPSG:4326"));
        }

        var geom = new ol.geom.Polygon([coordsDCS]);
        geom.transform(ol.proj.getTransform("DCS", "EPSG:4326"));
        var feature = new ol.Feature({
            object_type: "building",
            geometry: geom//(new ol.geom.Polygon([coordsDCS])).transform(ol.proj.getTransform("DCS", "EPSG:4326"))
        });
        
        return feature;
    };

    this.getMap = function() { return map; };
    
    this.pingLocation = function(options) {
        var map = this.getMap();
        var featureOverlay = this.makeFeatureOverlay();
        
        var radius = 5;
        var opacity = 1;
        
        var feature = new ol.Feature({
            geometry: new ol.geom.Point(options.coordinate)
        });
        featureOverlay.addFeature(feature);
        window.dbg.f = featureOverlay;
        
        function step() {
            var newStyle = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: radius,
                    fill: new ol.style.Fill({
                        color: 'rgba('+(options.rgb || '255,0,0')+','+opacity.toString()+')'
                    }),
                    stroke: new ol.style.Stroke({
                        width: 1,
                        color: "red",
                    }),
                })
            })
            featureOverlay.setStyle(newStyle);                    
            
            radius += 3;
            opacity = Math.max(.1, opacity - .15);
            
            if (radius < (options.maxRadius || 40)) {
                setTimeout(step, 30);
            } else {
                featureOverlay.setMap(null);
            }
        };
        step();
        
    }

    this.makeFeatureOverlay = function() {
        var featureOverlay = new ol.FeatureOverlay({
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 0.2)'
                }),
                stroke: new ol.style.Stroke({
                    color: '#ffcc33',
                    width: 2
                }),
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({
                        color: '#ffcc33'
                    })
                })
            })
        });
        featureOverlay.setMap(map);
        return featureOverlay;
    };
    
    this.styleFunction = function(feature, resolution) {
        var styles = [];

        if (feature.get("object_type") == "liveunit") {
            styles.push(new ol.style.Style({
                image: new ol.style.Icon({
                    src: '/eagledynamics/mapicons/'+feature.get("iconbasename")+"_"+feature.get("coalition")+".png",
                    //rotation: feature.get("heading"),
                }),
                text: new ol.style.Text({
                    text: "^",
                    rotation: feature.get("heading") + (map ? map.getView().getRotation() : 0),
                    fill: new ol.style.Fill({color: "#ffffff"}),
                    stroke: new ol.style.Stroke({color: "#000000", width: 1}),
                    font: "150% Verdana",

                }),
            }));
            
        } else if (feature.get("object_type") == "trackingedge") {
            if (feature.get("hostile")) {
                styles.push(new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        width: 10,
                        color: "rgba(255,0,0,.8)",
                    }),
                }));
            } else {
                styles.push(new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        width: 2,
                        color: "rgba(0,255,0,1)",
                    }),
                }));
            }
        } else {
            styles.push(new ol.style.Style({
                stroke: new ol.style.Stroke({
                    width: 2,
                    color: "rgba(180,20,20,.9)",
                }),
                fill: new ol.style.Fill({
                    color: "rgb(0,0,0)",
                }),
            }));
        }
        return styles;
 
    };
    
    this.redrawObject = function(obj) {
        // remove old features
        (features_by_object_id[obj.id] || []).forEach(function(feature) {
            vectorSource.removeFeature(feature);
        });
        delete features_by_object_id[obj.id];
        
        // draw the object if it should be visible
        if (uiScope.visibleObjectTypes.indexOf(obj.type) == -1) return;
        if (obj.type == "liveunit" && obj.coalition == 1 && $rootScope.visible_units.indexOf(obj.id) == -1) return;
        
        var features = [];
        if (obj.type == "cliparea") {
            feature = new ol.Feature({
                object_id: obj.id,
                object_type: obj.type,
                geometry: new ol.geom.Polygon(obj.coordinates)
            });
            features.push(feature);
        };
        if (obj.type == "liveunit") {
            feature = new ol.Feature({
                object_id: obj.id,
                object_type: obj.type,
                coalition: (obj.coalition == 2) ? "blue" : "red",
                iconbasename: UNITDATA[obj.unittype] ? UNITDATA[obj.unittype].iconbasename : "unknown", 
                geometry: new ol.geom.Point(ol.proj.transform([obj.pos.p.z, obj.pos.p.x], "DCS", "EPSG:4326")),
                heading: Math.atan2(obj.pos.x.z, obj.pos.x.x),//obj.heading,
                unittype: obj.unittype,
            });
            features.push(feature);
        };
        if (obj.type == "trackingedge") {
            if (!$rootScope.objects[obj.spotter_id] || !$rootScope.objects[obj.target_id]) return;
            var pos_a = $rootScope.objects[obj.spotter_id].pos.p;
            var pos_b = $rootScope.objects[obj.target_id].pos.p;
            var hostile = ($rootScope.objects[obj.spotter_id].coalition == 1);
            if ((hostile && !uiScope.showHostileTrackingEdges) || (!hostile && !uiScope.showFriendlyTrackingEdges)) return;
            feature = new ol.Feature({
                object_id: obj.id,
                object_type: "trackingedge",
                geometry: new ol.geom.LineString([ol.proj.transform([pos_a.z, pos_a.x], "DCS", "EPSG:4326"),
                                                  ol.proj.transform([pos_b.z, pos_b.x], "DCS", "EPSG:4326")]),
                hostile: ($rootScope.objects[obj.spotter_id].coalition == 1),
            });
            features.push(feature);
            //console.log(feature);
        };
        features_by_object_id[obj.id] = features;
        vectorSource.addFeatures(features);
    };
    this.redrawObjectType = function(type) {
        _.each($rootScope.objects, function(obj) {
            if (obj.type == type) this.redrawObject(obj);
        }, this);
    };
    
    uiScope.$watch('showFriendlyTrackingEdges', $.proxy(function() { this.redrawObjectType("trackingedge"); }, this));
    uiScope.$watch('showHostileTrackingEdges', $.proxy(function() { this.redrawObjectType("trackingedge"); }, this));
    uiScope.$watch('visibleObjectTypes', $.proxy(function(newValue) {
        (Object.keys($rootScope.objects) || []).forEach(function(id) {
            this.redrawObject($rootScope.objects[id]);
        }, this);
    }, this));
    
    this.init = function() {
        var resolutions = new Array(14);
        for (var z = 0; z < 14; ++z) {
            // generate resolutions and matrixIds arrays for this WMTS
            var tiles_x = Math.pow(2, z+1);
            var tiles_y = Math.pow(2, z);
            resolutions[z] = 180 / Math.pow(2, z) / 256;
        }
        vectorSource = new ol.source.Vector();
        vectorLayer = new ol.layer.Vector({
            source: vectorSource,
            style: this.styleFunction,
        });
        
        buildingSource = new ol.source.Vector();
        buildingLayer = new ol.layer.Vector({
            source: buildingSource,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: "rgb(0,0,0)",
                }),
            })
        });
        
        var mapLayer = new ol.layer.Tile({
            source: new ol.source.TileImage({
                projection: projection,
                extent: [37, 41, 46, 45.5],
                tileGrid: new ol.tilegrid.TileGrid({
                    origin: [-180, -90],
                    resolutions: resolutions,
                    tileSize: 256,
                }),
                style: 'default',
                tileUrlFunction: function(coord) {
                    var url = "http://chuck.j8r.de:8100/DCS-EPSG4326/";
                    var coord_extent = this.tileGrid.getTileCoordExtent(coord);
                    if (!ol.extent.intersects(coord_extent, this.getExtent())) return "";
                    return url+coord.z.toString()+"/"+coord.x.toString()+"/"+coord.y.toString()+".png";
                },
            }),
        });
        
        map = new ol.Map({
            layers: [
                mapLayer,
                buildingLayer,
                vectorLayer,
            ],
            target: $element[0],
            view: new ol.View2D({
                center: [42.06,42.27],
                projection: projection,
                extent: [37, 41, 46.5, 45.5],
                zoom: 7,
                maxZoom: 26,
            })
        });
        map.getView().on("propertychange", function(evt) { 
            if (evt.key=="rotation") {
                vectorLayer.setStyle(vectorLayer.getStyle());
            }
        });
        window.dbg.map = map;
        
        uiScope.setClipboxes = function() {
            uiScope.clipboxes = [
                [[41.5, 42], [41.5, 43], [42, 43], [42, 41.5]],
                [[43.0, 43.0], [44.0, 43.0], [44.0, 44.0], [43.0, 44.0]]
            ];
        };


        this.scene = new THREE.Scene();
        $.getJSON("buildings.json").then($.proxy(function(buildings) {
            buildings.forEach(function(building) {
                var feature = this.makeBuildingFeature(building);
                if (feature)
                    buildingSource.addFeatures([feature]);
                
                var box = building.box;
                var center = building.center;
                if (box) {
                    var geometry = new THREE.BoxGeometry(box.max.x - box.min.x,
                                                         box.max.y - box.min.y,
                                                         box.max.z - box.min.z);
                    var material = new THREE.MeshBasicMaterial({color: 0xaeaeae});
                    var mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(center.x, center.y, center.z);
                    mesh.rotateY(-Math.atan2(building.pos.x.z, building.pos.x.x));
                    //buildingMeshes.push(mesh);
                    this.scene.add(mesh);
                }
            }, this);
            this.scene.updateMatrixWorld();
        }, this));
        
        this.pos_a = new THREE.Vector3();
        this.pos_b = new THREE.Vector3();
        this.line = new THREE.Line3(this.pos_a, this.pos_b);
        this.direction = new THREE.Vector3();
        this.rc = new THREE.Raycaster(this.pos_a, this.direction);
        this.checkLOS = function(a, b) {
            
            this.pos_a.setX(a.pos.p.x);
            this.pos_a.setY(a.pos.p.y);
            this.pos_a.setZ(a.pos.p.z);
            this.pos_b.setX(b.pos.p.x);
            this.pos_b.setY(b.pos.p.y);
            this.pos_b.setZ(b.pos.p.z);

            this.direction.subVectors(this.pos_b, this.pos_a).normalize();

            var intersections = this.rc.intersectObjects(this.scene.children);
            
            if (!intersections.length) return true;
            var building_distance = intersections[0].distance;
            var distance = this.line.distance();
            visible = !!(building_distance > distance);
            //console.log(visible, building_distance, distance);
            return visible;
        };


        this.benchmarkSpotChecks = function(rounds) {
            dbg.results = [];
            rounds = rounds || 10;
            var starttime = Date.now();
            var ids = Object.keys($rootScope.objects)
                .filter(function(k) { return $rootScope.objects[k].type == "liveunit" });
            var i, j, count, round;
            count = 0;
            console.log(ids.length, "ids.");
            for (round=0; round<rounds; round++) {
                for (i=0; i<ids.length; i++) {
                    for (j=0; j<ids.length; j++) {
                        var a = $rootScope.objects[ids[i]];
                        var b = $rootScope.objects[ids[j]];
                        if (!(a && b)) {
                        } else {
                            var z = this.checkLOS(a, b);
                        }
                        dbg.results.push(z);
                        count++;
                    }
                }
            }
            var duration = Date.now() - starttime;
            var msg = (count.toString()+" in "+duration.toFixed(2)+" ms ("+(count/duration*1000).toFixed(2)+" per second)");
            console.log(msg);
        }

        mapLayer.on('precompose', function(event) {
            var ctx = event.context;
            ctx.save();
            var tf = event.frameState.coordinateToPixelMatrix;
            
            if (uiScope.clipboxes === null) return;
            
            ctx.beginPath();
            var clipboxes = uiScope.clipboxes.map(function(clipbox) {
                return clipbox.map(function(vec2) {
                    var ret = vec2.slice();
                    return ol.vec.Mat4.multVec2(tf, vec2, ret);
                });
            });;
            clipboxes.forEach(function(clipbox) {
                
                ctx.moveTo.apply(ctx, clipbox[0]);

                
                for (var i=0; i<=clipbox.length; i++)
                    ctx.lineTo.apply(ctx, clipbox[i%clipbox.length]);
                
            });
            ctx.clip();
        });
        mapLayer.on('postcompose', function(event) {
            event.context.restore();
        });
        

        uiScope.$watch('clipboxes', function(newVal) {
            map.render();
        });

        
        $rootScope.$on('new-object', $.proxy(function(event, obj) {
            this.redrawObject(obj);
        }, this));
        $rootScope.$on('delete-object', $.proxy(function(event, obj) {
            (features_by_object_id[obj.id] || []).forEach(function(feature) {
                vectorSource.removeFeature(feature);
            });
            delete features_by_object_id[obj.id];
        }, this));
        Object.keys($rootScope.objects).forEach(function(id) {
            this.redrawObject($rootScope.objects[id]);
        }, this);

        $(map.getViewport()).on('mousemove', function(evt) {
            var pixel = map.getEventPixel(evt.originalEvent);
            var feature = map.forEachFeatureAtPixel(pixel, function(feature, layer) {
                return feature;
            });
            var info = "&nbsp;";
            if (feature) {
                if (feature.get("object_type") == "liveunit") {
                    info = feature.get("unittype")+"<br>"+feature.get("object_id");
                }
            }
            
            $("#hoveredFeatureInfo").html(info);
        });
    };
}]);
