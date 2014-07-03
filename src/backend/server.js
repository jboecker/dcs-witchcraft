var express = require('express');
var app = express();
var port = 3000;
var io = require('socket.io').listen(app.listen(port, "0.0.0.0"));
var Q = require('q');
var net = require('net');
var events = require('events');
var underscore = require("underscore");
var appevents = new events.EventEmitter();
var assert = require("assert");
var Graph = require("data-structures").Graph;

var UndirectedGraph = function() {
    var graph = new Graph();
    this.addNode = function(nodeId) { return graph.addNode(nodeId); };
    this.getNode = function(nodeId) { return graph.getNode(nodeId); };
    this.removeNode = function(nodeId) { return graph.removeNode(nodeId); };
    
    var a, b;
    var order = function(id1, id2) {
        if (id1 < id2) { a = id1; b = id2; }
        else { a = id2; b = id1; }
    };
    this.addEdge = function(fromId, toId, weight) {
        order(fromId, toId);
        return graph.addEdge(a, b, weight);
    };
    this.getEdge = function(fromId, toId) {
        order(fromId, toId);
        return graph.getEdge(a, b);
    };
    this.removeEdge = function(fromId, toId) {
        order(fromId, toId);
        return graph.removeEdge(a, b);
    };
    this.getAllEdgesOf = function(nodeId) { return  graph.getAllEdgesOf(nodeId); };
    this.forEachNode = function(operation) { return graph.forEachNode(operation); };
    this.forEachEdge = function(operation) { return graph.forEachEdge(operation); };
    this.toString = function() { return graph.toString(); };
};

app.use(express.static(__dirname+'/../frontend'))
    .get('/', function(request, response) {
        response.render('../frontend/index.html');
    });


var instance = {
    objects: {},
    next_id: 1,
}
    
var update_objects = function(changes) {
    (changes.deleted_object_ids || []).forEach(function(id) {
        delete instance.objects[id];
    });
    
    Object.keys(changes.objects || []).forEach(function(id) {
        var obj = changes.objects[id];
        instance.objects[obj.id] = obj;
    });
    
    io.sockets.in("players").emit('update', { objects: (changes.objects || []),
                                              deleted_object_ids: (changes.deleted_object_ids || []) });
}
    
function get_obj_distance(a, b) {
    return Math.sqrt(Math.pow(a.pos.p.x - b.pos.p.x, 2) +
                     Math.pow(a.pos.p.y - b.pos.p.y, 2) +
                     Math.pow(a.pos.p.z - b.pos.p.z, 2));
}

function UnitManager() {
    var units = new Graph(); // nodes: unit info, edges: directed unit-related info (tracking)
    var undirectedInfo = new UndirectedGraph(); // edges: undirected unit-related info (line-of-sight) 
    
    this.process_unitupdate = function(new_or_updated_objects, deleted_object_ids) {
        // remove deleted units
        underscore.each(deleted_object_ids, function(id) {
            units.removeNode(id);
            undirectedInfo.removeNode(id);
        });

        // update existing units and create new ones
        underscore.each(new_or_updated_objects, function(obj) {
            var unit = units.getNode(obj.id);
            if (!unit) {
                // create the unit node and the new edges in the undirected info graph
                var directed_edges_to_init = [];
                udInfo = undirectedInfo.addNode(obj.id);
                units.forEachNode(function(otherUnit) {
                    var udEdge = undirectedInfo.addEdge(obj.id, otherUnit.id);
                    assert.ok(udEdge);
                    udEdge.building_los = null;
                    udEdge.terrain_los = null;
                    udEdge.line_of_sight = null;
                    udEdge.is_enemy = (obj.coalition != otherUnit.coalition);
                    udEdge.unit_ids = [obj.id, otherUnit.id];
                    
                    directed_edges_to_init.push([obj.id, otherUnit.id]);
                    directed_edges_to_init.push([otherUnit.id, obj.id]);
                });
                
                // create the unit node in the unit graph
                unit = units.addNode(obj.id);
                unit.id = obj.id;
                unit.category = obj.category;
                unit.coalition = obj.coalition;
                unit.known_to_enemy = false;
                
                // create the new (directed) edges in the unit graph
                // (now that the unit node exists there)
                directed_edges_to_init.forEach(function(ids) {
                    var id_a = ids[0]; var id_b = ids[1];
                    var dEdge = units.addEdge(id_a, id_b);
                    dEdge.unit = units.getNode(id_a);
                    dEdge.otherUnit = units.getNode(id_b);
                    dEdge.udEdge = undirectedInfo.getEdge(id_a, id_b);
                    assert.ok(dEdge.udEdge);
                    dEdge.unit_ids = [id_a, id_b];
                    dEdge.tracking = false;
                    dEdge.last_known_position = null;
                });
            }
            unit.pos = obj.pos;
            unit.alt_agl = obj.alt_agl;
        }, this);
        
        // recalculate distances
        undirectedInfo.forEachEdge(function(udEdge) {
            var a = units.getNode(udEdge.unit_ids[0]);
            var b = units.getNode(udEdge.unit_ids[1]);
            udEdge.distance = get_obj_distance(a, b);
        });
    };
    
    this.process_terrain_los_update = function(msg) {
        var obj_ids = [];
        msg.ids.forEach(function(id) { obj_ids.push("liveunit-"+id); });
        var vislist = msg.vislist;
        var i, j, k, count;
        k = 0;
        count = 0;
        for (i=0; i<obj_ids.length; i++) {
            for (j=i+1; j<obj_ids.length; j++) {
                var e = undirectedInfo.getEdge(obj_ids[i], obj_ids[j]);
                if (e) {
                    if (vislist[k]) {
                        //if (!e.terrain_los) console.log("new terrain edge: ", obj_ids[i], obj_ids[j]);
                        e.terrain_los = true;
                    } else {
                        //if (e.terrain_los) console.log("removed terrain edge: ", obj_ids[i], obj_ids[j]);
                        e.terrain_los = false;
                    }
                    e.line_of_sight = e.building_los && e.terrain_los;
                    if (e.terrain_los) count++;
                }
                k++;
            }
        }
        if (underscore.difference(Object.keys(instance.objects), obj_ids).length != 0)
            console.log("terrain keys differ");
        //console.log("terUpd", obj_ids.length, count);
    };
    
    this.process_building_los_update = function(msg) {
        var obj_ids = [];
        msg.ids.forEach(function(id) { obj_ids.push(id); });
        var vislist = msg.vislist;
        var i, j, k, count;
        k = 0;
        count = 0;
        for (i=0; i<obj_ids.length; i++) {
            for (j=i+1; j<obj_ids.length; j++) {
                var e = undirectedInfo.getEdge(obj_ids[i], obj_ids[j]);
                if (e) {
                    if (vislist[k]) {
                        //if (!e.building_los) console.log("new building edge: ", obj_ids[i], obj_ids[j]);
                        e.building_los = true;
                    } else {
                        //if (e.building_los) console.log("removed building edge: ", obj_ids[i], obj_ids[j]);
                        e.building_los = false;
                    }
                    e.line_of_sight = e.building_los && e.terrain_los;
                    assert.ok(vislist[k] !== undefined);
                    if (e.building_los) count++;
                }
                k++;
            }
        }
        if (underscore.difference(Object.keys(instance.objects), obj_ids).length != 0) {
            //console.log("building keys differ", Object.keys(instance.objects), obj_ids);
            console.log("building keys differ");
        }
        //console.log("processed building visibility update", obj_ids.length, count);
    };
    
    function positionsSimilar(a, b) {
        if (!a && !b) return false;
        return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.z - b.z) < 1;
    };
    
    function mk1Eyeball(dEdge) {
        var distance = dEdge.udEdge.distance;
        var interpolate = function(x, p1, p2) {
            var m = (p2[1] - p1[1]) / (p2[0] - p1[0]);
            return p1[1] + (x - p1[0])*m;
        };
        var eyeballRange = 2000;
        var binocularRange = 10000;
        var maxrangeBinocularP = 1/800;
        var maxrangeEyeballP = 1/30;
        if (distance > binocularRange) {
            return 0;
        } else if (distance < eyeballRange) {
            // spot using Mk1 eyeballs (go peripheral vision!)
            return interpolate(distance, [0, 1], [eyeballRange, maxrangeEyeballP]);
        } else {
            // spot using binoculars
            if (dEdge.unit.category == "plane")
                return 0; // airplane pilots do not get binoculars
            return interpolate(distance, [eyeballRange, maxrangeEyeballP], [binocularRange, maxrangeBinocularP]);
        }
    };
    
    function startTrackingProbability(dEdge) {
        if (dEdge.udEdge.distance > 10000) return 0;
        
        var unit = dEdge.unit;
        var otherUnit = dEdge.otherUnit;
        
        var chance = mk1Eyeball(dEdge);
        if (dEdge.otherUnit.known_to_enemy)
            chance += .4; // bonus for tracking a target that my allies already know about
        
        if (chance == 0)
            return 0;
        
        if (unit.alt_agl < 20 && otherUnit.alt_agl > 46)
            chance += .3; // bonus for tracking flying targets above 150 ft AGL
        if (dEdge.last_known_position && positionsSimilar(dEdge.last_known_position.p, dEdge.otherUnit.pos.p))
            chance += .2; // bonus for tracking targets that have not moved from the last known position
        
        return chance;
    };
    
    this.doSpotChecks = function() {
        var trackingEdgeObjects = [];
        units.forEachNode(function(unit) {
            units.getOutEdgesOf(unit.id).forEach(function(dEdge) {
                // loose track of units that are out of LOS or binocular range
                if (dEdge.tracking && (!dEdge.udEdge.line_of_sight || dEdge.udEdge.distance > 10000)) {
                    //dEdge.last_known_position = dEdge.otherUnit.pos;
                    dEdge.tracking = false; 
                }

                if (!dEdge.tracking && dEdge.udEdge.line_of_sight && dEdge.udEdge.is_enemy) {
                    var chance = startTrackingProbability(dEdge);
                    var die = Math.random();
                    //console.log(unit.id, "check tracking start", dEdge.otherUnit.id, chance, die);
                    if (die < chance) {
                        dEdge.tracking = true;
                        if (dEdge.unit.id.match(/Pilot/))
                            console.log("******* ", unit.id, "started tracking", dEdge.otherUnit.id, "distance = ",dEdge.udEdge.distance, "chance was ", chance);
                    }
                }
            });
        });
        
        var visible_objects = [];
        var ai_visibility = {}; // will be sent to DCS; map of unit_name->boolean
        units.forEachNode(function(unit) {
            unit.known_to_enemy = false;
            ai_visibility[unit.id.substr(9)] = false;
        });
        
        var visible_objects = [];
        units.forEachEdge(function(dEdge) {
            if (dEdge.tracking) {
                dEdge.otherUnit.known_to_enemy = true;
                visible_objects.push(dEdge.otherUnit.id);
                ai_visibility[dEdge.otherUnit.id.substr(9)] = true;
            }
        });
        
        visible_objects = underscore.uniq(visible_objects);
        io.sockets.in("players").emit('update-visible-units-set', visible_objects);
        appevents.emit("set-unit-ai-visibility", ai_visibility);
        //console.log("rcVis", visible_objects.length);
        
        var trackingEdgeObjects = [];
        units.forEachEdge(function(dEdge) {
            if (dEdge.tracking)
                trackingEdgeObjects.push({id: ++instance.next_id, type: "trackingedge", spotter_id: dEdge.unit.id, target_id: dEdge.otherUnit.id});
            
        });
        
        var dte = [];
        underscore.each(instance.objects, function(obj) {
            if (obj.type == "trackingedge") dte.push(obj.id);
        });
        //console.log(dte);
        update_objects({objects: trackingEdgeObjects, deleted_object_ids: dte});
    }
}
var unitmanager = new UnitManager();

setInterval(function(){ unitmanager.doSpotChecks(); }, 2000);

appevents.on("terrain-vis-update", function(msg) {
    unitmanager.process_terrain_los_update(msg);
});

io.sockets.on('connection', function(socket) {
    socket.on('disconnect', function() {
        
    });
    
    socket.on('init', function(data) {
        socket.emit('update', { objects: instance.objects, 
                                deleted_object_ids: [] });
        socket.join('players');
    });
    
    socket.on('log', function(data) {
        console.log("*** LOG: ", data);
    });
    
    socket.on('smoke', function(params) {
        appevents.emit("smoke", params);
    });
    
    socket.on('lua', function(params) {
        appevents.emit('lua', params);
    });
    
    socket.on('building-vis-update', function(msg) {
        unitmanager.process_building_los_update(msg);
    });

    socket.on('ping', function(data) {
        io.sockets.emit("ping", data);
    });
    
    socket.on('delete-object', function(id) {
        update_objects({ deleted_object_ids: [id,] });
    });
    
    socket.on('create-cliparea', function(coords) {
        update_objects({ objects: [{ id: (++instance.next_id).toString(),
                             type: "cliparea",
                             coordinates: coords,
                           }],
               });
    });
    
    socket.on('create-entry', function(data) {
        update_objects({ objects: [{ id: (++instance.next_id).toString(),
                             type: "entry",
                             name: data,
                           }],
               });
    });
    
});

var livedataserver = net.createServer(function(ldsocket) {
    console.log('DCS connected.');
    io.sockets.emit("dcs-connected");
    
    var linebuffer = '';
    ldsocket.on('data', function(data) {
        linebuffer += data;
        var pos = linebuffer.indexOf('\n');
        while (pos >= 0) {
            ldsocket.emit('line', linebuffer.substring(0, pos));
            linebuffer = linebuffer.substring(pos+1);
            pos = linebuffer.indexOf('\n');
        }
    });
    ldsocket.on('line', function(line) {
        try {
            var msg = JSON.parse(line);
            if (msg.type == "unitupdate") {
                var deleted_ids = [];
                var objects = [];
                var alive_unit_object_ids = [];
                if (msg.units === undefined) console.log("MSG:",msg);
                msg.units.forEach(function(unit) {
                    objects.push({
                        id: "liveunit-"+unit.uN,
                        type: "liveunit",
                        pos: unit.pd,
                        unittype: unit.t,
                        heading: unit.hdg,
                        coalition: unit.c,
                        category: unit.cat,
                        alt_agl: unit.alt,
                    });
                    alive_unit_object_ids.push("liveunit-"+unit.uN);
                }, this);
                
                (Object.keys(instance.objects) || []).forEach(function(id) {
                    var obj = instance.objects[id];
                    if (obj.type == "liveunit" && alive_unit_object_ids.indexOf(obj.id) == -1)
                        deleted_ids.push(obj.id);
                });
                update_objects({ objects: objects, deleted_object_ids: deleted_ids });
                unitmanager.process_unitupdate(objects, deleted_ids);
            }
            if (msg.type == "smokeconfirm") {
                io.sockets.emit("smokeconfirm", msg);
            }
            if (msg.type == "luaresult") {
                io.sockets.emit("luaresult", msg);
            }
            if (msg.type == "log") {
                io.sockets.emit("log", msg);
            }
            if (msg.type == "terrain-vis-update") {
                appevents.emit("terrain-vis-update", msg);
            }
        } catch(e) {console.log(e.stack)}        
    });

    appevents.on('smoke', function(params) {
        try {
            ldsocket.write(JSON.stringify({
                type: "smoke",
                lon: params.lon,
                lat: params.lat,
                color: params.color
            }).replace("\n", "")+"\n");
        } catch(e) {
            console.log(e.stack);
        }
    });
    appevents.on("set-unit-ai-visibility", function(vmap) {
        try {
            ldsocket.write(JSON.stringify({type: "set-unit-ai-visibility", units: vmap}).replace("\n","")+"\n");
            //console.log("updAI");
        } catch(e) {}
    });
    appevents.on('lua', function(params) {
        try {
            ldsocket.write(JSON.stringify({
                type: "lua",
                code: params.code,
				name: params.name,
            }).replace("\n","")+"\n");
        } catch(e) {
            console.log(e.stack);
        }
    });
    
    ldsocket.on('disconnect', function() {
        try {
            console.log('DCS disconnected.');
        } catch(e) {}
    });
}).listen(3001);

process.on('uncaughtException', function(err) {
    console.log("UNCAUGHT EXCEPTION: ", err.stack);
});
