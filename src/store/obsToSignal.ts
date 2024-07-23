import { Observable } from 'rxjs';
import { createSignalState } from '../utils/signalPrimitives/createSignal';
import { Signal } from 'signal-polyfill';
import { effect } from './effect';

export function obsToSignal<T>(obs: Observable<T>, getDefaultValue: () => T): Signal.State<T>;
export function obsToSignal<T>(obs: Observable<T>): Signal.State<T | undefined>;
export function obsToSignal<T>(obs: Observable<T>, getDefaultValue?: () => T) {
    return createSignalState(getDefaultValue?.(), (s) => {
        const sub = obs.subscribe((v) => {
            s.set(v);
        });
        return () => {
            sub.unsubscribe();
        };
    });
}

export function signalToObs<T>(signal: Signal.Computed<T> | Signal.State<T>) {
    return new Observable<T>((subscriber) => {
        const dispose = effect(() => {
            const events = signal.get();
            subscriber.next(events);
        });
        return dispose;
    });
}
