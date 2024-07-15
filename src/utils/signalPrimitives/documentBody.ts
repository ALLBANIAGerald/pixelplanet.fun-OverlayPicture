import { createSignalState } from './createSignal';

/**
 * When running userscript with `// @run-at document-start` document.body might not exist yet
 * will return document.body as soon as it is found with MutationObserver
 */
export const documentBody = createSignalState<HTMLElement | undefined>(document.body, (s) => {
    let observer: MutationObserver | undefined;
    let domContentLoadedHandler: (() => void) | undefined;
    queueMicrotask(() => {
        if (s.get()) return;
        observer = new MutationObserver(function () {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (document.body) {
                s.set(document.body);
                observer?.disconnect();
                observer = undefined;
                if (domContentLoadedHandler) document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
            }
        });
        observer.observe(document.documentElement, { childList: true });
        domContentLoadedHandler = () => {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (document.body) {
                s.set(document.body);
                observer?.disconnect();
                observer = undefined;
                if (domContentLoadedHandler) document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
            }
        };
        document.addEventListener('DOMContentLoaded', domContentLoadedHandler);
    });
    return () => {
        observer?.disconnect();
        if (domContentLoadedHandler) document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
    };
});
