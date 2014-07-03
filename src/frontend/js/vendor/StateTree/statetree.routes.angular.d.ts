interface RouteOpts {
    priority?: number;
}
interface RouteMaker {
    (state: State, route: any[], get?: () => any[], set?: (...params: any[]) => ng.IPromise, opts?: RouteOpts): void;
}
interface Window {
    routeGenerator: (routeProvider: ng.IRouteProviderProvider, $location: ng.ILocationService, $q: ng.IQService, $rootScope: ng.IRootScopeService, waitOn: ng.IPromise) => RouteMaker;
}
