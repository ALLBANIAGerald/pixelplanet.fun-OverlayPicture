import { Signal } from 'signal-polyfill';

interface AnySignal<T> {
    get: () => T;
}
export function createSignalComputedNested<T>(computation: () => AnySignal<T> | T) {
    const wrapper = new Signal.Computed(() => computation());
    return new Signal.Computed(() => {
        const nested = wrapper.get();
        if (nested && typeof nested === 'object' && 'get' in nested) return nested.get();
        return nested;
    });
}
