import { Signal } from 'signal-polyfill';

interface AnySignal<T> {
    get: () => T;
}
export function createSignalComputedNested<T>(computation: () => AnySignal<T>) {
    const nested = new Signal.Computed(() => computation());
    return new Signal.Computed(() => nested.get().get());
}
