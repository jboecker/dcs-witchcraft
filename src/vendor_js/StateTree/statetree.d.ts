interface EnhancedError extends Error {
    stack: any;
}
interface MakeStateTree {
    (): StateChart;
}
interface StateChart {
    root: RootState;
    currentStates(): AnyState[];
    activeStates(): AnyState[];
    isActive: {
        [name: string]: bool;
    };
    statesByName: {
        [name: string]: AnyState;
    };
    stateFromName(name: string): AnyState;
    handleError(e: Error, cb: () => void): bool;
    defaultToHistory: bool;
    defaultToHistoryState();
    enterFn(state: State): void;
    enterFn(state: State, data: any): void;
    exitFn(state: State): void;
    enter(fn: StateCallback): void;
    exit(fn: StateCallback): void;
    safeCallback(cb: () => void): bool;
    signal(name: string, cb: Function): Function;
}
interface StateDataCallback {
    (state: State): void;
    (state: State, data: any): void;
}
interface StateCallback {
    (state: State, data?: any): void;
}
interface HasStateCallbacks {
    enter(fn: (state: State) => void): State;
    enter(fn: (state: State, data: any) => void): State;
    exit(fn: StateCallback): State;
}
interface StateIntersection extends HasStateCallbacks {
}
interface AnyState extends HasStateCallbacks {
    name: string;
    statechart: StateChart;
    childStates: State[];
    defaultSubState?: State;
    history?: State;
    subStatesAreConcurrent: bool;
    concurrentSubStates();
    enterFns: StateDataCallback[];
    exitFns: StateCallback[];
    subState(name: string, nestingFn?: (State: any) => void): State;
    defaultTo(state: State): State;
    changeDefaultTo(state: State): State;
    goTo(data?: any): State[];
    defaultState();
    activeSubState(): State;
    onlyEnterThrough(...states: State[]);
    allowedFrom?: State[];
    setData(data: any): State;
    isActive(): bool;
    activeChildState(): State;
    data: any;
    intersect(...states: State[]): StateIntersection;
}
interface State extends AnyState {
    parentState: State;
}
interface RootState extends AnyState {
}
