(function (_, undefined) {
    var DEBUG = true;
    function State(name, parentState) {
        this.name = name;
        this.childStates = [];
        this.subStatesAreConcurrent = false;
        this.enterFns = [];
        this.exitFns = [];
        if(parentState) {
            this.parentState = parentState;
            parentState.childStates.push(this);
            this.statechart = parentState.statechart;
            if(this.statechart.statesByName[name]) {
                throw new Error("state already exists: " + name);
            }
            this.statechart.statesByName[name] = this;
        }
    }
    State.prototype.subState = function (name, nestingFn) {
        var state = new State(name, this);
        if(nestingFn) {
            nestingFn(state);
        }
        return state;
    };
    State.prototype.defaultState = function () {
        if(!this.parentState) {
            throw new Error("cannot default root state");
        }
        this.parentState.defaultTo(this);
        return this;
    };
    State.prototype.changeDefaultTo = function (state) {
        if(this.subStatesAreConcurrent) {
            errorDefaultAndConcurrent(state);
        }
        this.defaultSubState = state;
        return this;
    };
    State.prototype.defaultTo = function (state) {
        if(this.defaultSubState) {
            throw new Error("default sub state '" + this.defaultSubState.name + "' already exists. Will not change it to '" + state.name + "'. To dynamically change default states use '.changeDefaultTo'");
        }
        return this.changeDefaultTo(state);
    };
    var errorDefaultAndConcurrent = function (state) {
        throw new Error("cannot have a default sub state among concurrent states");
    };
    State.prototype.concurrentSubStates = function () {
        if(this.defaultSubState) {
            errorDefaultAndConcurrent(this.defaultSubState);
        }
        this.subStatesAreConcurrent = true;
        return this;
    };
    State.prototype.enter = function (fn) {
        this.enterFns.push(fn);
        return this;
    };
    State.prototype.exit = function (fn) {
        this.exitFns.push(fn);
        return this;
    };
    State.prototype.onlyEnterThrough = function () {
        var states = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            states[_i] = arguments[_i + 0];
        }
        if(this.allowedFrom) {
            throw new Error("allowed states are already set");
        }
        this.allowedFrom = _.map(states, function (state) {
            return state.name;
        });
        return this;
    };
    State.prototype.setData = function (data) {
        this.data = data;
        return this;
    };
    State.prototype.isActive = function () {
        return !!this.statechart.isActive[this.name];
    };
    State.prototype.activeChildState = function () {
        return _.find(this.childStates, function (state) {
            return state.isActive();
        });
    };
    function exitStates(exited) {
        return _.any(exited.reverse(), function (state) {
            var stopTransition = _.any(state.exitFns, function (exitFn) {
                return !state.statechart.safeCallback(function () {
                    exitFn(state);
                });
            });
            if(stopTransition) {
                return stopTransition;
            }
            state.statechart.isActive[state.name] = false;
            if(state.parentState) {
                state.parentState.history = state;
            }
            return !state.statechart.safeCallback(function () {
                state.statechart.exitFn(state);
            });
        });
    }
    function iterateActive(tree, cb) {
        _.each(tree.childStates, function (state) {
            if(state.isActive()) {
                cb(state);
                iterateActive(state, cb);
            }
        });
    }
    function moveUpToActive(state, entered) {
        if(state.isActive()) {
            return state;
        } else {
            entered.push(state);
            return moveUpToActive(state.parentState, entered);
        }
    }
    var inGoTo = [];
    function handlePendingGoTo(currentState) {
        var nextState = inGoTo.shift();
        if(inGoTo.length > 0) {
            throw new Error("requested to goTo multiple other states " + _(inGoTo).pluck('name') + " while using a goTo to enter state " + currentState.name);
        }
        if(nextState) {
            nextState.goTo();
        }
    }
    State.prototype.goTo = function (data) {
        var _this = this;
        if(inGoTo.length > 0) {
            inGoTo.push(this);
            return;
        }
        function returnWith(arg) {
            handlePendingGoTo(this);
            return arg;
        }
        var statechart = this.statechart;
        var entered = [];
        var exited = [];
        var alreadyActive = moveUpToActive(this, entered);
        entered.reverse();
        if(alreadyActive.name === this.name) {
            return returnWith([]);
        }
        if(!alreadyActive.subStatesAreConcurrent) {
            _.each(alreadyActive.childStates, function (state) {
                if(state.name != entered[0].name) {
                    if(state.isActive()) {
                        exited.push(state);
                        iterateActive(state, function (s) {
                            return exited.push(s);
                        });
                    }
                }
            });
        }
        var expected = this;
        if(entered.length > 0) {
            var last = null;
            var def = null;
            while(def = ((last = entered[entered.length - 1]) && ((statechart.defaultToHistory && last.history) || last.defaultSubState))) {
                entered.push(def);
                expected = def;
            }
        } else {
            throw new Error("impossible!");
        }
        _.each(entered, function (state) {
            if(!state.allowedFrom || state.allowedFrom.length === 0) {
                return;
            }
            if((state.allowedFrom.indexOf(_this.name) === -1) && (state.name !== _this.name)) {
                throw new Error("cannot transition to state '" + state.name + "' from '" + _this.name + "'. Allowed states: " + state.allowedFrom.join(", "));
            }
        });
        if(exitStates(exited)) {
            return returnWith(null);
        }
        if(_.any(entered, function (state) {
            var dataParam = _this.name === state.name ? data : undefined;
            var stopTransition = _.any(state.enterFns, function (enterFn) {
                !statechart.safeCallback(function () {
                    enterFn(state, dataParam);
                });
            });
            if(stopTransition) {
                return stopTransition;
            }
            statechart.isActive[state.name] = true;
            return !statechart.safeCallback(function () {
                statechart.enterFn(state, dataParam);
            });
        })) {
            return returnWith(null);
        }
        if(DEBUG) {
            if(statechart.currentStates().indexOf(expected) === -1) {
                throw new Error("expected to go to state " + this.name + ", but now in states " + _(statechart.currentStates()).pluck('name').join(","));
            }
        }
        return returnWith(exited);
    };
    State.prototype.intersect = function () {
        var states = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            states[_i] = arguments[_i + 0];
        }
        states.unshift(this);
        return new StateIntersection(states);
    };
    function StateIntersection(states) {
        this.states = states;
    }
    StateIntersection.prototype.enter = function (fn) {
        var _this = this;
        var enterFn = function (changingState) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            if(_.all(_this.states, function (state) {
                return state.name === changingState.name || state.isActive();
            })) {
                if(DEBUG) {
                    console.log('enter intersection: ' + _.map(_this.states, function (state) {
                        return state.name;
                    }).join(' & '));
                }
                args.unshift(changingState);
                fn.apply(undefined, args);
            }
        };
        _.each(this.states, function (state) {
            state.enter(enterFn);
        });
    };
    StateIntersection.prototype.exit = function (fn) {
        var _this = this;
        var exitFn = function (changingState) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            if(_.all(_this.states, function (state) {
                return state.name === changingState.name || !state.isActive();
            })) {
                if(DEBUG) {
                    console.log('exit intersection: ' + _.map(_this.states, function (state) {
                        return state.name;
                    }).join(' & '));
                }
                args.unshift(changingState);
                fn.apply(undefined, args);
            }
        };
        _.each(this.states, function (state) {
            state.exit(exitFn);
        });
    };
    function StateChart(root, extensions) {
        var statesByName = {
        };
        statesByName[root.name] = root;
        var isActive = {
        };
        isActive[root.name] = true;
        var Signal = extensions.Signal || function () {
            throw new Error("error using tree.signal(): statetree.signal.js is not loaded");
        };
        var chart = {
            root: root,
            statesByName: statesByName,
            stateFromName: function (name) {
                var res = statesByName[name];
                if(!res) {
                    throw new Error("invalid state name: " + name);
                }
                return res;
            },
            isActive: isActive,
            handleError: function (e) {
                if(e.message) {
                    console.log(e.message);
                }
                if(e.stack) {
                    console.log(e.stack);
                }
                return false;
            },
            defaultToHistory: false,
            defaultToHistoryState: function () {
                this.defaultToHistory = true;
            },
            activeStates: function () {
                var actives = [
                    this.root
                ];
                iterateActive(this.root, function (state) {
                    return actives.push(state);
                });
                return actives;
            },
            currentStates: function () {
                var leaves = [];
                var statechart = this;
                iterateActive(statechart.root, function (state) {
                    if(!_.any(state.childStates, function (child) {
                        return child.isActive();
                    })) {
                        leaves.push(state);
                    }
                });
                return (leaves.length === 0) ? [
                    this.root
                ] : leaves;
            },
            enterFn: function (state, data) {
                if(DEBUG) {
                    console.log("entering " + state.name);
                }
            },
            enter: function (fn) {
                this.enterFn = fn;
                return this;
            },
            exitFn: function (state) {
                if(DEBUG) {
                    console.log("exiting: " + state.name + " history of " + state.parentState.name);
                }
            },
            exit: function (fn) {
                this.exitFn = fn;
                return this;
            },
            safeCallback: function (cb) {
                if(!cb) {
                    return true;
                }
                try  {
                    cb();
                    return true;
                } catch (e) {
                    return this.handleError(e, cb);
                }
            },
            signal: function (name, cb) {
                var _this = this;
                var signal = new Signal(name);
                cb(signal);
                signal.allStatesHandled();
                return function () {
                    return signal.dispatch(_this, arguments);
                };
            }
        };
        root.statechart = chart;
        return chart;
    }
    var makeStateTree = function () {
        return StateChart(new State("root"), makeStateTree);
    };
    if(typeof window !== "undefined") {
        window['makeStateTree'] = makeStateTree;
    }
    if(typeof ender === 'undefined') {
        this['makeStateTree'] = makeStateTree;
    }
    if(typeof define === "function" && define.amd) {
        define("makeStateTree", [], function () {
            return makeStateTree;
        });
    }
}).call(this, lodash);
//@ sourceMappingURL=statetree.js.map
