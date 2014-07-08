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
