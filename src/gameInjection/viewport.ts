import logger from '../handlers/logger';
import { createSignalComputed, createSignalState } from '../utils/signalPrimitives/createSignal';
import { documentBody } from '../utils/signalPrimitives/documentBody';
import { createSignalComputedNested } from '../utils/signalPrimitives/createSignalComputedNested';
import { signalToObs } from '../store/obsToSignal';
import { filter, fromEvent, map, mergeWith, shareReplay, switchMap } from 'rxjs';

function isViewportElement(element: HTMLElement): boolean {
    if (element.tagName.toUpperCase() !== 'CANVAS') return false;
    if (!element.className.includes('viewport')) return false;
    return true;
}

export const viewPortSignal = createSignalComputedNested(() => {
    const body = documentBody.get();
    if (!body) return;
    const canvases = body.getElementsByTagName('canvas');
    return createSignalState<HTMLCanvasElement | undefined>(undefined, (s) => {
        queueMicrotask(() => {
            const viewport = Array.from(canvases).find((c) => isViewportElement(c) && s.get() !== c);
            if (viewport !== s.get()) s.set(viewport);
        });

        const onMutationEvent = (mutations: MutationRecord[]): void => {
            mutations.forEach((mutation) => {
                if (mutation.type !== 'childList') {
                    // We are only looking for canvas changes.
                    return;
                }
                mutation.removedNodes.forEach((node) => {
                    if (node === s.get()) {
                        logger.log('Active viewport was removed');
                        // our viewport was just removed, clean it up.
                        s.set(undefined);
                    }
                });
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeName.toUpperCase() !== 'CANVAS') {
                        // Don't care about everything except if it's canvas element.
                        return;
                    }
                    const canvasNode = node as HTMLCanvasElement;
                    if (isViewportElement(canvasNode)) {
                        logger.log('Active viewport was added');
                        s.set(canvasNode);
                    }
                });
            });
        };

        const observer = new MutationObserver(onMutationEvent);
        observer.observe(document, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            queueMicrotask(() => {
                s.set(undefined);
            });
        };
    });
});

function addViewPortPassiveEventSignal<K extends keyof HTMLElementEventMap>(eventKey: K) {
    const viewPortSignalOnTouchStartHookPassiveSignal = createSignalComputedNested(() => {
        const viewPort = viewPortSignal.get();
        if (!viewPort) return;
        return createSignalState<HTMLElementEventMap[K] | undefined>(undefined, (s) => {
            const handler = (e: HTMLElementEventMap[K]) => {
                s.set(e);
            };
            viewPort.addEventListener(eventKey, handler, { passive: true });
            return () => {
                queueMicrotask(() => {
                    s.set(undefined);
                });
                viewPort.removeEventListener(eventKey, handler);
            };
        });
    });
    return viewPortSignalOnTouchStartHookPassiveSignal;
}

const viewPort$ = signalToObs(viewPortSignal);
export const viewPortIsMouseDown$ = viewPort$.pipe(
    filter((x) => x !== undefined),
    switchMap((viewPort) =>
        fromEvent(viewPort, 'mousedown').pipe(
            map(() => true),
            mergeWith(fromEvent(viewPort, 'mouseup').pipe(map(() => false)))
        )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
);

export const viewPortSignalOnTouchStartHookPassiveSignal = addViewPortPassiveEventSignal('touchstart');
export const viewPortSignalOnMouseMoveHookPassiveSignal = addViewPortPassiveEventSignal('mousemove');
export const viewPortSignalOnMouseDownHookPassiveSignal = addViewPortPassiveEventSignal('mousedown');
export const viewPortSignalOnMouseUpHookPassiveSignal = addViewPortPassiveEventSignal('mouseup');
export const viewPortSignalOnWheelHookPassiveSignal = addViewPortPassiveEventSignal('wheel');

export const viewPortTouchClientCoordinatesSignal = createSignalComputed(() => {
    const event = viewPortSignalOnTouchStartHookPassiveSignal.get();
    if (!event) return undefined;
    const touches = event.touches[0];
    if (!touches) return;
    const { clientX, clientY } = touches;
    return { clientX, clientY, timestamp: Date.now() };
});
