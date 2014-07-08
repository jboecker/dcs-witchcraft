(function (_, undefined) {
    function routeGenerator(routeProvider, $location, $q, $rootScope, waitOn) {
        var priorities = {
        };
        var activeState = null;
        return function (state, route, get, set, opts) {
            if (typeof get === "undefined") { get = function () {
                return [];
            }; }
            if (typeof set === "undefined") { set = function () {
                return null;
            }; }
            if (typeof opts === "undefined") { opts = {
            }; }
            if(opts.priority) {
                priorities[state.name] = opts.priority;
            }
            var nParams = 0;
            var routeVars = [];
            var routeStr = '/' + _.map(route, function (piece, i) {
                if(angular.isString(piece)) {
                    return piece;
                }
                nParams = nParams + 1;
                var routeVar = i.toString();
                routeVars.push({
                    name: routeVar,
                    transform: piece
                });
                return ':' + routeVar;
            }).join('/');
            if(nParams > 0) {
                if(!get || !set) {
                    throw new Error("expected a get & set function");
                }
                if(set.length !== nParams) {
                    throw new Error("Expected set functions to take " + nParams + " params. However, set takes " + set.length + " params");
                }
            }
            routeProvider.when(routeStr, {
                template: '<div></div>',
                controller: [
                    '$routeParams', 
                    function ($routeParams) {
                        try  {
                            var transformedVars = _.map(routeVars, function (routeVar) {
                                return routeVar.transform($routeParams[routeVar.name]);
                            });
                        } catch (e) {
                            if(e.trace) {
                                console.log(e.trace);
                            }
                            console.log(e.toString());
                            console.log("error parsing routes, redirecting to root");
                            $location.path('/');
                        }
                        var promise = set.apply(null, transformedVars);
                        var goTo = function () {
                            state.goTo({
                                urlAlreadySet: true
                            });
                        };
                        var promises = _.compact([
                            promise && promise.then && promise, 
                            waitOn
                        ]);
                        if(promises.length > 0) {
                            $q.all(promises).then(goTo);
                        } else {
                            goTo();
                        }
                    }                ]
            });
            state.enter(function (_state, data) {
                if(data && data.urlAlreadySet) {
                    setActiveState(state);
                    return;
                }
                if(routeVars.length > 0) {
                    var paramValues = get();
                    if(!angular.isArray(paramValues)) {
                        throw new Error("expected an array from route get function for: " + _state.name);
                    }
                    if(paramValues.length !== routeVars.length) {
                        throw new Error("Expected get function to return " + routeVars.length + " values.");
                    }
                }
                updateLocation(paramValues);
            });
            function setActiveState(state) {
                if(activeState) {
                    var newPriority = priorities[state.name] || 0;
                    var oldPriority = priorities[activeState.name] || 0;
                    if(oldPriority > newPriority && activeState.isActive()) {
                        return false;
                    }
                }
                activeState = state;
                return true;
            }
            function updateLocation(paramValues) {
                if(!setActiveState(state)) {
                    return;
                }
                var routeVarsPosition = 0;
                $location.path(_.map(route, function (piece, i) {
                    if(angular.isString(piece)) {
                        return piece;
                    }
                    routeVarsPosition = routeVarsPosition + 1;
                    return paramValues[routeVarsPosition - 1];
                }).join('/'));
            }
        };
    }
    if(typeof window !== "undefined") {
        window.routeGenerator = routeGenerator;
    }
    if(typeof ender === 'undefined') {
        this['routeGenerator'] = routeGenerator;
    }
    if(typeof define === "function" && define.amd) {
        define("routeGenerator", [], function () {
            return routeGenerator;
        });
    }
}).call(this, lodash);
//@ sourceMappingURL=statetree.routes.angular.js.map
