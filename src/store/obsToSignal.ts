import { Observable, shareReplay } from 'rxjs';
import { createSignalState } from '../utils/signalPrimitives/createSignal';
import { Signal } from 'signal-polyfill';
import { effect } from './effect';
import { StoredSignal } from './slices/overlaySlice';

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

export function signalToObs<T>(signal: Signal.Computed<T> | Signal.State<T> | StoredSignal<T>) {
    return new Observable<T>((subscriber) => {
        const dispose = effect(() => {
            const events = Array.isArray(signal) ? signal[0]() : signal.get();
            subscriber.next(events);
        });
        return dispose;
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
}
