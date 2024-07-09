import type { EffectCallback } from 'react';
import { Signal } from 'signal-polyfill';

/**
 * Flag indicating if microtasks need to be enqueued.
 */
let needsEnqueue = true;

/**
 * Watcher for signals.
 */
const signalWatcher = new Signal.subtle.Watcher(() => {
    if (needsEnqueue) {
        needsEnqueue = false;
        queueMicrotask(processPending);
    }
});

/**
 * Process pending signals.
 */
function processPending() {
    needsEnqueue = true;
    signalWatcher.getPending().forEach((s) => s.get());
    signalWatcher.watch();
}

/**
 * Executes the provided callback as an effect.
 */
export function effect(callback: EffectCallback) {
    let cleanup: ReturnType<EffectCallback>;

    const computed = new Signal.Computed(() => {
        if (typeof cleanup === 'function') cleanup();
        cleanup = callback();
    });

    signalWatcher.watch(computed);
    computed.get();

    return function destroyEffect() {
        signalWatcher.unwatch(computed);
        if (typeof cleanup === 'function') cleanup();
    };
}
