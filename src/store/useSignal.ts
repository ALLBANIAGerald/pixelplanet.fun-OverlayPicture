import { Signal } from 'signal-polyfill';

import { StoredSignal } from './slices/overlaySlice';
import { effect } from './effect';
import { createEffect, createSignal, onCleanup } from 'solid-js';

export function useSignal<T>(signal: Signal.Computed<T> | Signal.State<T> | StoredSignal<T>) {
    const [getS, setS] = createSignal<T>(Array.isArray(signal) ? signal[0]() : signal.get());
    createEffect(() => {
        const descructor = effect(() => {
            setS(() => (Array.isArray(signal) ? signal[0]() : signal.get()));
        });
        onCleanup(descructor);
    });
    return getS;
}
