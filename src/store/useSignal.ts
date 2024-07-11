import { useEffect, useState } from 'react';
import { Signal } from 'signal-polyfill';

import { StoredSignal } from './slices/overlaySlice';
import { effect } from './effect';

export function useSignal<T>(signal: Signal.Computed<T> | Signal.State<T> | StoredSignal<T>) {
    const [s, setS] = useState<T>(Array.isArray(signal) ? signal[0]() : signal.get());
    useEffect(() => {
        return effect(() => {
            setS(Array.isArray(signal) ? signal[0]() : signal.get());
        });
    }, [signal]);
    return s;
}
