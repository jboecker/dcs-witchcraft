/// <reference path="../../common/types/angular-1.0.d.ts" />
/// <reference path="./statetree.d.ts" />
declare var lodash
declare var angular

// for exports
declare var ender
declare var define
declare var module

interface RouteOpts {
  // watch?: bool;
  priority?: number;
}
interface RouteMaker {
  (state: State, route: any[], get?: () => any[], set?:(...params:any[]) => ng.IPromise, opts?: RouteOpts): void;
}
interface Window { routeGenerator: (routeProvider: ng.IRouteProviderProvider, $location: ng.ILocationService, $q: ng.IQService, $rootScope: ng.IRootScopeService, waitOn: ng.IPromise) => RouteMaker; }

// dependencies: AngularJS routing and lodash/underscore for map, probably should write my own map function
//
// Uses AngularJS routing system which is not a great match for our needs
// You must add an <ng-view> tag to your app for this to work, and going to a route specified here will fill it with an empty div
// please note that it also wants the routeProvider: you can save that off to a variable at config time and then pass it in.
//
// If you want the route to be removed on exit, just manually clear the location on exit
//   state.exit(function(){ $location.path('/') })
(function(_, undefined){
  // var DEBUG = true

  function routeGenerator(
    routeProvider : ng.IRouteProviderProvider,
    $location     : ng.ILocationService,
    $q            : ng.IQService,
    $rootScope    : ng.IRootScopeService,
    waitOn?       : ng.IPromise) {

    var priorities = {}
    var activeState : State = null


    // The get and set parameterers are callbacks.
    // If the set callback should return nothing or a promise.
    // If it returns a promise, the state transition will not occur until the promise is resolved
    return (
    state : State,
    route : any[],
    get?  : () => any[] = function(){return []},
    set?  : (...params: any[]) => ng.IPromise = function(){return null},
    opts? : RouteOpts = {}): void => {

      if (opts.priority) { priorities[state.name] = opts.priority }

      var nParams = 0
      var routeVars = []
      var routeStr = '/' + _.map(route, (piece, i) => {
        if (angular.isString(piece)) return piece
        nParams = nParams + 1
        var routeVar = i.toString()
        routeVars.push({name: routeVar, transform:piece})
        return ':' + routeVar
      }).join('/')

      if (nParams > 0) {
        if (!get || !set) throw new Error("expected a get & set function")
        if (set.length !== nParams)
          throw new Error(
            "Expected set functions to take " + nParams +
            " params. However, set takes " +
            set.length + " params"
          )
      }

      // if (DEBUG) { console.log(routeStr) }

      routeProvider.when(routeStr, {
        template:'<div></div>'
      , controller: [<any>'$routeParams', ($routeParams) => {
          try {
            var transformedVars = _.map(routeVars, (routeVar) => routeVar.transform($routeParams[routeVar.name]))
          } catch (e) {
            if (e.trace) { console.log(e.trace) }
            console.log(e.toString())
            console.log("error parsing routes, redirecting to root")
            $location.path('/')
          }

          var promise = set.apply(null, transformedVars)
          var goTo = () => { 
            // if (DEBUG) { console.log('goto ' + routeStr) }
            state.goTo({urlAlreadySet: true})
          }
          var promises = _.compact([promise && promise.then && promise, waitOn])
          if (promises.length > 0) { $q.all(promises).then(goTo) } else { goTo() }
        }]
      })

      state.enter((_state, data) => {
        if (data && data.urlAlreadySet) {
            setActiveState(state)
            return
        }

        if (routeVars.length > 0) {
          var paramValues = get()
          if (!angular.isArray(paramValues)) {
            throw new Error("expected an array from route get function for: " + _state.name)
          }
          if (paramValues.length !== routeVars.length) {
            throw new Error ("Expected get function to return " +
              routeVars.length + " values."
            )
          }
        }

        //if (!opts.watch)
        updateLocation(paramValues)
      })

      function setActiveState(state: State): bool {
        if (activeState){
          var newPriority = priorities[state.name] || 0
          var oldPriority = priorities[activeState.name] || 0
          if (oldPriority > newPriority && activeState.isActive()) {
            return false
          }
        }

        activeState = state
        return true
      }

      function updateLocation(paramValues: any): void {
        if (!setActiveState(state)) { return }

        var routeVarsPosition = 0
        $location.path(
          _.map(route, (piece, i) => {
            if (angular.isString(piece)) return piece
            routeVarsPosition = routeVarsPosition + 1
            return paramValues[routeVarsPosition - 1]
          }).join('/')
        )
      }

      /*
      * this is broken because updateLocation triggers the angularjs router which calls the controller and set.apply
      * I don't think setting a flag to ignore the route change here is guaranteed to work
      if (opts.watch) {
        state.setData({deregister: null})
          .enter(() => {
            state.data.deregister = $rootScope.$watch(get, updateLocation, true)
        }).exit(() => {
            if (state.data.deregister) state.data.deregister()
        })
      }
      */
    }
  }

  // module is a reserved word in TypeScript, guess I need to use their module thing
  // if(typeof this.module !== "undefined" && module.exports) { module.exports = makeStateTree; }
  if (typeof window !== "undefined") { window.routeGenerator = routeGenerator; }
  if (typeof ender === 'undefined') { this['routeGenerator'] = routeGenerator; }
  if (typeof define === "function" && define.amd) { define("routeGenerator", [], function () { return routeGenerator; }); }
}).call(this, lodash)
