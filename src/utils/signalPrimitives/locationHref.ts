import { unsafeWindow } from 'vite-plugin-monkey/dist/client';
import { Observable, shareReplay } from 'rxjs';

export const locationHrefObs = new Observable<URL>((subscriber) => {
    subscriber.next(new URL(location.href));
    const sendNext = () => {
        subscriber.next(new URL(location.href));
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- overriding intentional
    const originalPushState = unsafeWindow.history.pushState;
    unsafeWindow.history.pushState = function (...args) {
        originalPushState.apply(unsafeWindow.history, args);
        sendNext();
    };

    // eslint-disable-next-line @typescript-eslint/unbound-method -- overriding intentional
    const originalReplaceState = unsafeWindow.history.replaceState;
    unsafeWindow.history.replaceState = function (...args) {
        originalReplaceState.apply(unsafeWindow.history, args);
        sendNext();
    };

    const handlePopState = () => {
        sendNext();
    };
    unsafeWindow.addEventListener('popstate', handlePopState);

    return () => {
        unsafeWindow.history.pushState = originalPushState;
        unsafeWindow.history.replaceState = originalReplaceState;
        unsafeWindow.addEventListener('popstate', handlePopState);
    };
}).pipe(shareReplay({ bufferSize: 1, refCount: true }));
