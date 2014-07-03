app.controller('View3D', ['$rootScope', '$element', 'model', function($rootScope, $element, model) {
    console.log("View3D initializing");

	var scene = new THREE.Scene();
	var camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 12000);
    dbg.camera = camera;
	var renderer = new THREE.CanvasRenderer();
	renderer.setSize($element.width(), $element.height());
    var stateDiv = $("<div>")
        .css("width", "100%")
        .css("height", "30px")
        .css("position", "relative")
        .css("left", "0px")
        .css("right", "0px")
    $element[0].appendChild(stateDiv[0]);
    $element[0].appendChild(renderer.domElement);
    
    meshes_by_object_id = {}
    var buildingMeshes = [];
    
    dbg.camtype = "a2b";
    dbg.alt = 200;
    
	var render = function () {
		requestAnimationFrame(render);
		renderer.render(scene, camera);
        
        var a, b;
        var log = [];
        Object.keys($rootScope.objects).forEach(function(id) {
            var obj = $rootScope.objects[id];
            if (obj.id == $rootScope.view3DSpotter) a = obj;
            if (obj.id == $rootScope.view3DTarget) b = obj;
        });
        

        if (!(a && b)) {
            stateDiv.text("Spotter: " + $rootScope.view3DSpotter+" Target: " + $rootScope.view3DTarget);
            stateDiv.css("background-color", "#fff");
            return;
        };
        var pos_a = new THREE.Vector3(a.pos.p.x, a.pos.p.y, a.pos.p.z);
        var pos_b = new THREE.Vector3(b.pos.p.x, b.pos.p.y, b.pos.p.z);
        var line = new THREE.Line3(pos_a, pos_b);
        dbg.line = line;
        var direction = new THREE.Vector3();
        direction.subVectors(pos_b, pos_a).normalize();
        var rc = new THREE.Raycaster(pos_a, direction);
        var intersections = rc.intersectObjects(buildingMeshes);
  
        var building_distance = intersections.length ? intersections[0].distance : null;
        var distance = line.distance();
        var visible;
        if (building_distance == null)
            visible = true;
        else
            visible = !!(building_distance > distance);
        
        stateDiv.text(JSON.stringify([
            $rootScope.view3DSpotter,
            $rootScope.view3DTarget,
            visible,
            parseInt(building_distance),
            parseInt(distance)
        ]));
        stateDiv.css("background-color", visible ? "rgb(0,255,0)" : "red");
	    };
    

	render();


    $rootScope.$on("new-object", function(event, obj) {
        if (meshes_by_object_id[obj.id]) {
            scene.remove(meshes_by_object_id[obj.id]);
            delete meshes_by_object_id[obj.id];
        }
        if (obj.type == "liveunit") {
            
            var geometry = new THREE.BoxGeometry(2,2,2);
            var material = new THREE.MeshBasicMaterial({color: obj.coalition == 2 ? 0x0000ff : 0xff0000});
            var mesh = new THREE.Mesh(geometry, material);
            meshes_by_object_id[obj.id] = mesh;
            mesh.position.set(obj.pos.p.x, obj.pos.p.y, obj.pos.p.z);
            scene.add(mesh);
            
            if (obj.id == $rootScope.view3DSpotter) {
                if (dbg.camtype == "a2b") {
                    camera.position.x = obj.pos.p.x;
                    camera.position.y = obj.pos.p.y;
                    camera.position.z = obj.pos.p.z;
                    
                    if ($rootScope.view3DSpotter == $rootScope.view3DTarget) {
                        
                        camera.up = new THREE.Vector3(obj.pos.y.x, obj.pos.y.y, obj.pos.y.z);
                        camera.lookAt(new THREE.Vector3(obj.pos.p.x + obj.pos.x.x,
                                                        obj.pos.p.y + obj.pos.x.y,
                                                        obj.pos.p.z + obj.pos.x.z));
                        if (dbg.lookAtHook) dbg.lookAtHook(obj);

                    }
                }
                if (dbg.camtype == "test") {
                    camera.position.x = obj.pos.p.x;
                    camera.position.y = obj.pos.p.y + dbg.alt;
                    camera.position.z = obj.pos.p.z;
                
                    camera.lookAt(new THREE.Vector3(obj.pos.p.x,
                                                    obj.pos.p.y,
                                                    obj.pos.p.z));
                    if (dbg.lookAtHook) dbg.lookAtHook(obj);
                }
            } else if (obj.id == $rootScope.view3DTarget && obj.id != $rootScope.view3DSpotter) {
                if (dbg.camtype == "a2b") {
                        
                    camera.lookAt(new THREE.Vector3(obj.pos.p.x + obj.pos.x.x,
                                                    obj.pos.p.y + obj.pos.x.y,
                                                    obj.pos.p.z + obj.pos.x.z));
                    if (dbg.lookAtHook) dbg.lookAtHook(obj);
                    
                    
                }
            }
        }

    });
    
    $.getJSON("buildings.json").then(function(buildings) {
        buildings.forEach(function(building) {
            var box = building.box;
            var center = building.center;
            if (!box) {
                return; // no collision geometry? no LOS blocking!
            }
            var geometry = new THREE.BoxGeometry(box.max.x - box.min.x,
                                                 box.max.y - box.min.y,
                                                 box.max.z - box.min.z);
            var material = new THREE.MeshBasicMaterial({color: 0xaeaeae});
            var mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(center.x, center.y, center.z);
            mesh.rotateY(-Math.atan2(building.pos.x.z, building.pos.x.x));
            buildingMeshes.push(mesh);
            scene.add(mesh);
        });
    });
}]);
