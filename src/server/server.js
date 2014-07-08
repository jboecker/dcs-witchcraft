var express = require('express');
var app = express();
var port = 3000;
var io = require('socket.io').listen(app.listen(port, "0.0.0.0"));
var Q = require('q');
var net = require('net');
var events = require('events');
var _ = require("lodash");
var appevents = new events.EventEmitter();
var assert = require("assert");
var Graph = require("data-structures").Graph;
/*
var MissionModel = require("../frontend/js/missionmodel.js").MissionModel;

var missionModel = new MissionModel(function(eventname, data) {
	io.sockets.emit(eventname, data);
});

*/
app.use(express.static(__dirname+'/../frontend'))
    .get('/', function(request, response) {
        response.render('../frontend/index.html');
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

    socket.on('ping', function(data) {
        io.sockets.emit("ping", data);
    });
    
});

var dcsconnector = net.createServer(function(dcs_socket) {
    console.log('DCS connected.');
    io.sockets.emit("dcs-connected");
    
    var linebuffer = '';
    dcs_socket.on('data', function(data) {
        linebuffer += data;
        var pos = linebuffer.indexOf('\n');
        while (pos >= 0) {
            dcs_socket.emit('line', linebuffer.substring(0, pos));
            linebuffer = linebuffer.substring(pos+1);
            pos = linebuffer.indexOf('\n');
        }
    });
    dcs_socket.on('line', function(line) {
        try {
            var msg = JSON.parse(line);
			var op = {} ;
			/*
            if (msg.type == "unitupdate") {
				op.type = "liveunitupdate";
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
			*/
            if (msg.type == "smokeconfirm") {
                io.sockets.emit("smokeconfirm", msg);
            }
            if (msg.type == "luaresult") {
                io.sockets.emit("luaresult", msg);
            }
            if (msg.type == "log") {
                io.sockets.emit("log", msg);
            }
			/*
            if (msg.type == "terrain-vis-update") {
                appevents.emit("terrain-vis-update", msg);
            }
			*/
        } catch(e) {console.log(e.stack)}        
    });

    appevents.on('smoke', function(params) {
        try {
            dcs_socket.write(JSON.stringify({
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
            dcs_socket.write(JSON.stringify({type: "set-unit-ai-visibility", units: vmap}).replace("\n","")+"\n");
            //console.log("updAI");
        } catch(e) {}
    });
    appevents.on('lua', function(params) {
        try {
            dcs_socket.write(JSON.stringify({
                type: "lua",
                code: params.code,
				name: params.name,
            }).replace("\n","")+"\n");
        } catch(e) {
            console.log(e.stack);
        }
    });
    
    dcs_socket.on('disconnect', function() {
        try {
            console.log('DCS disconnected.');
        } catch(e) {}
    });
}).listen(3001);

process.on('uncaughtException', function(err) {
    console.log("UNCAUGHT EXCEPTION: ", err.stack);
});

console.log("Waiting for DCS to connect...")
