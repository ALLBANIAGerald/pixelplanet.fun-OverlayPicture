import { Signal } from 'signal-polyfill';

export function createSignalState<T>(initialValue: T, watchedEffect?: (thisSignal: Signal.State<T>) => undefined | (() => void), equals?: Signal.Options<T>['equals']) {
    const options: Signal.Options<T> = {};
    if (equals) options.equals = equals;
    if (watchedEffect) {
        let latestCleanup: (() => void) | undefined;
        options[Signal.subtle.watched] = () => {
            latestCleanup = watchedEffect(signal);
        };
        options[Signal.subtle.unwatched] = () => {
            latestCleanup?.();
        };
    }
    const signal = new Signal.State(initialValue, options);
    return signal;
}

export function createSignalComputed<T>(computation: () => T, watchedEffect?: (thisSignal: Signal.Computed<T>) => undefined | (() => void), equals?: Signal.Options<T>['equals']) {
    const options: Signal.Options<T> = {};
    if (equals) options.equals = equals;
    if (watchedEffect) {
        let latestCleanup: (() => void) | undefined;
        options[Signal.subtle.watched] = () => {
            latestCleanup = watchedEffect(signal);
        };
        options[Signal.subtle.unwatched] = () => {
            latestCleanup?.();
        };
    }
    const signal = new Signal.Computed(computation, options);
    return signal;
}
