(function (_, undefined) {
    function Signal(name) {
        this.name = name;
        this.transitions = [];
    }
    Signal.prototype.dispatch = function (tree, args) {
        var _this = this;
        var data = this.cb && this.cb.apply(undefined, args);
        _.each(this.transitions, function (trans) {
            if(_.any(trans.from, function (state) {
                return state.isActive();
            })) {
                trans.to.goTo(_this.cb ? data : (trans.with ? trans.with.apply(undefined, args) : undefined));
            }
        });
    };
    Signal.prototype.allStatesHandled = function (cb) {
        return this;
    };
    Signal.prototype.with = function (cb) {
        if(this.transitions.length === 0) {
            this.cb = cb;
            return this;
        }
        var trans = this.transitions[this.transitions.length - 1];
        if(trans.with) {
            throw new Error("Signal setup encountered with() twice in a row");
        }
        if(this.cb) {
            throw new Error("Individual with callbacks cannot be combined with the callback for all transitions of this signal");
        }
        trans.with = cb;
        return this;
    };
    Signal.prototype.from = function () {
        var froms = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            froms[_i] = arguments[_i + 0];
        }
        this.transitions.push({
            from: froms,
            to: null,
            with: null
        });
        var lastTrans = this.transitions[this.transitions.length - 2];
        if(lastTrans && !lastTrans.to) {
            throw new Error("previous transition did not specify to()");
        }
        return this;
    };
    Signal.prototype.to = function (to) {
        var trans = this.transitions[this.transitions.length - 1];
        if(trans.to) {
            throw new Error("Signal setup encountered to() twice in a row");
        }
        trans.to = to;
        return this;
    };
    if(typeof window !== "undefined") {
        window['makeStateTree']['Signal'] = Signal;
    }
    if(typeof ender === 'undefined') {
        this['makeStateTree']['Signal'] = Signal;
    }
    if(typeof define === "function" && define.amd) {
        define([
            "makeStateTree"
        ], function (makeStateTree) {
            makeStateTree.Signal = Signal;
            return function () {
            };
        });
    }
}).call(this, lodash);
//@ sourceMappingURL=statetree.signal.js.map
