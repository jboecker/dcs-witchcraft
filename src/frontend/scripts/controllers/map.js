witchcraft.controller('MapController', ['$rootScope', '$element', 'UNITDATA', 'luashell', 'model', 'uistatetree', function($rootScope, $element, UNITDATA, luashell, model, uistatetree) {
    var map = null;
    var projection = ol.proj.get('EPSG:4326');
    var features_by_object_id = {};
    var vectorSource, vectorLayer;
    var dcsProjection = "+proj=tmerc +lat_0=0 +lon_0=33 +k_0=0.9996 +x_0=-99517 +y_0=-4998115";
    window.dbg.mapController = this;
	uistatetree.setMapController(this);
    this.getDCSProjection = function() { return dcsProjection; };
	
    this.getMap = function() { return map; };
	
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
    
	this.groupFeatures_ = {};
	this.redrawGroup = function(group) {
		if (this.groupFeatures_[group.groupId]) {
			_.each(this.groupFeatures_[group.groupId], function(feature) { vectorSource.removeFeature(feature); });
		};
		
		var features = [];
		_.each(group.units, function(unit) {
			window.dbg.UNITDATA = UNITDATA;
            feature = new ol.Feature({
                object_type: "liveunit",
                coalition: group.coalition,
                iconbasename: UNITDATA[unit.type] ? UNITDATA[unit.type].iconbasename : "unknown", 
                geometry: new ol.geom.Point(ol.proj.transform([unit.y, unit.x], "DCS", "EPSG:4326")),
				heading: unit.heading,
                unittype: unit.type,
				unitId: unit.unitId,
				unitName: unit.name,
            });
			if (!UNITDATA[unit.type]) console.log("missing UNITDATA for type ", unit.type);
			features.push(feature);
		});
		window.dbg.vectorSource = vectorSource;
		this.groupFeatures_[group.groupId] = features;
		vectorSource.addFeatures(features);
		
	};
	
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

        $rootScope.$on('new-object', $.proxy(function(event, obj) {
            this.redrawObject(obj);
        }, this));
        $rootScope.$on('delete-object', $.proxy(function(event, obj) {
            (features_by_object_id[obj.id] || []).forEach(function(feature) {
                vectorSource.removeFeature(feature);
            });
            delete features_by_object_id[obj.id];
        }, this));
		
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
		
		// listen to model changes
		var mm = model.getMissionModel();
		window.dbg.mm = mm;
		
		mm.groups_.each(this.redrawGroup, this);
		var redrawHandler = _.bind(function(event) {
			this.redrawGroup(event.value);
		}, this);
		mm.groups_.on('new', redrawHandler);
		mm.groups_.on('update', redrawHandler);
		mm.groups_.on('delete', _.bind(function(event) {
			var features = this.groupFeatures_[event.oldValue.groupId];
			if (features) {
				_.each(features, function(f) { vectorSource.removeFeature(f); });
			}
		}, this));
		
    };
	uistatetree.getUIScope().stateFromName("uiMajorMode").goTo();
}]);
