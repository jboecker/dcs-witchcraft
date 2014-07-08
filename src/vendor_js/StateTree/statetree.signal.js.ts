/// <reference path="./statetree.d.ts" />
interface Transition {
  from: State[];
  to: State;
  with: Function;
}

interface Signal {
  name: string;
  cb: Function;
  transitions: Transition[];
}


(function(_, undefined){
  // calling this a signal because like js-signals it doesn't use strings.
  // http://millermedeiros.github.com/js-signals/
  function Signal(name: string){
    this.name = name
    this.transitions = [] 
  }

  // TODO: check parent-child relationship of states in allStatesHandled
  Signal.prototype.dispatch = function(tree: StateChart, args: any[]): void {
    var data = this.cb && this.cb.apply(undefined, args)
    _.each(this.transitions, (trans: Transition) => {
      if (_.any(trans.from, (state: State) => state.isActive())) {
        trans.to.goTo(this.cb ? data : (trans.with ? trans.with.apply(undefined, args) : undefined))
      }
    })
  }
  Signal.prototype.allStatesHandled = function(cb?: Function): Signal {
  // throw new Error("not all states handle signal " + this.name)
    return this
  }
  Signal.prototype.with = function(cb?: Function): Signal {
    // callback for all signal transitions
    if (this.transitions.length === 0){
      this.cb = cb
      return this
    }

    var trans = this.transitions[this.transitions.length - 1]
    if (trans.with) throw new Error("Signal setup encountered with() twice in a row")
    if (this.cb) throw new Error("Individual with callbacks cannot be combined with the callback for all transitions of this signal")
    trans.with = cb
    return this
  }

  Signal.prototype.from = function(...froms: State[]): Signal {
    this.transitions.push({from: froms, to: null, with: null})
    var lastTrans = this.transitions[this.transitions.length - 2]
    if (lastTrans && !lastTrans.to) throw new Error("previous transition did not specify to()")
    return this
  }

  Signal.prototype.to = function(to: State[]): Signal {
    var trans = this.transitions[this.transitions.length - 1]
    if (trans.to) throw new Error("Signal setup encountered to() twice in a row")
    trans.to = to
    return this
  }

  // module is a reserved word in TypeScript, guess I need to use their module thing
  // if(typeof this.module !== "undefined" && module.exports) { module.exports = makeStateTree; }
  if (typeof window !== "undefined") { window['makeStateTree']['Signal'] = Signal; }
  if (typeof  ender === 'undefined') { this['makeStateTree']['Signal'] = Signal; }
  if (typeof define === "function" && define.amd) { define(["makeStateTree"], function (makeStateTree) { makeStateTree.Signal = Signal; return ()=>{} }); }
}).call(this, lodash)

// imports
declare var lodash

// for exports
declare var ender
declare var define
declare var module
