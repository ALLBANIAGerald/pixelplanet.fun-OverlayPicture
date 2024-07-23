import { viewPortTouchClientCoordinatesSignal } from '../../gameInjection/viewport';
import { Signal } from 'signal-polyfill';
import {
    PageState,
    selectPageStateCanvasId,
    selectPageStateCanvasPalette,
    selectPageStateCanvasReservedColors,
    selectPageStateHoverPixel,
    selectPageStateRoundedCanvasViewCenter,
} from '../../utils/getPageReduxStore';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';
import { unsafeWindow } from 'vite-plugin-monkey/dist/client';
import { createSignalComputed, createSignalState } from '../../utils/signalPrimitives/createSignal';
import { createSignalComputedNested } from '../../utils/signalPrimitives/createSignalComputedNested';
import { map, Observable, share, shareReplay, switchMap } from 'rxjs';
import { effect } from '../effect';
import { EventEmitter } from 'events';
import { obsToSignal, signalToObs } from '../obsToSignal';
import { locationHrefObs } from '../../utils/signalPrimitives/locationHref';

export interface Cell {
    x: number;
    y: number;
}

/**
 * Filtered out reserved colors from the palette
 */
export const selectCanvasUserPalette = createSignalComputed(() => {
    const reservedColorCount = selectPageStateCanvasReservedColors.get();
    const palette = selectPageStateCanvasPalette.get();
    return palette.slice(reservedColorCount);
});

const pixelPlanetEvents = createSignalState(unsafeWindow.pixelPlanetEvents, (s) => {
    let definedSetter = false;
    if (!unsafeWindow.pixelPlanetEvents) {
        definedSetter = true;
        Object.defineProperty(unsafeWindow, 'pixelPlanetEvents', {
            set: (v) => {
                definedSetter = false;
                delete unsafeWindow.pixelPlanetEvents;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- workaround if events not initialized yet
                unsafeWindow.pixelPlanetEvents = v;
                s.set(unsafeWindow.pixelPlanetEvents);
            },
            configurable: true,
        });
        return;
    }

    queueMicrotask(() => {
        if (!s.get()) {
            s.set(unsafeWindow.pixelPlanetEvents);
        }
    });

    return () => {
        if (definedSetter) {
            delete unsafeWindow.pixelPlanetEvents;
        }
    };
});

function createEventSignal<T>(validate: (value: unknown) => value is T, defaultValue: T, eventName: 'setviewcoordinates' | 'setscale' | 'selectcanvas' | 'sethover' | 'receivechunk') {
    return createSignalComputedNested(() => {
        const events = pixelPlanetEvents.get();
        if (!events) return new Signal.State(defaultValue);
        return createSignalState(defaultValue, (s) => {
            const handleEvent = (value: unknown) => {
                if (!value) return;
                if (!validate(value)) return;
                s.set(value);
            };
            events.on(eventName, handleEvent);
            return () => events.off(eventName, handleEvent);
        });
    });
}

const selectedCanvasIdEventSignal = createEventSignal((v) => typeof v === 'string', undefined, 'selectcanvas');
const selectedCanvasIdFallbackSignal = createSignalComputed(() => {
    // Or watch url changes and convert from letter to id
    return selectPageStateCanvasId.get();
});
const selectedCanvasIdSignal = createSignalComputed(() => {
    const eventValue = selectedCanvasIdEventSignal.get();
    if (eventValue == null) return selectedCanvasIdFallbackSignal.get();
    return eventValue;
});

const hoverEventSignal = createEventSignal(
    (value): value is [number, number] => !!(value && Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number'),
    undefined,
    'sethover'
);
const hoverSignal = createSignalComputed(() => {
    const eventValue = hoverEventSignal.get();
    if (!eventValue) return selectPageStateHoverPixel.get();
    return eventValue;
});

const touchHoverPixelSignal = createSignalComputed(() => {
    const touchClientCoordinates = viewPortTouchClientCoordinatesSignal.get();
    if (!touchClientCoordinates) return;
    const { clientX, clientY, timestamp } = touchClientCoordinates;
    const { height, width } = windowInnerSize.get();
    const viewScale = viewScaleSignal.get();
    const viewCenter = viewCenterSignal.get();
    const x = Math.floor((clientX - width / 2) / viewScale + viewCenter.x);
    const y = Math.floor((clientY - height / 2) / viewScale + viewCenter.y);
    return { x, y, timestamp };
});

const hoverPixelSignal = createSignalComputed(() => {
    const touchPixel = touchHoverPixelSignal.get();
    const pageHover = latestPageHoverPixelState.get();
    const view = latestRoundedViewCenter.get();
    const latest = [touchPixel, pageHover, view].sort((a, b) => (b?.timestamp ?? 0) - (a?.timestamp ?? 0))[0];
    if (!latest) return { x: 0, y: 0 };
    return { x: latest.x, y: latest.y };
});

const latestPageHoverPixelState = createSignalComputed(() => {
    const p = selectPageStateHoverPixel.get();
    if (!p) return undefined;
    return { ...p, timestamp: Date.now() };
});

const latestRoundedViewCenter = createSignalComputed(() => {
    const view = selectPageStateRoundedCanvasViewCenter.get();
    if (!view) return undefined;
    return { ...view, timestamp: Date.now() };
});

const registerPixelUpdatesObs = new Observable<NonNullable<typeof unsafeWindow.registerPixelUpdates>>((subscriber) => {
    let definedSetter = false;
    if (!unsafeWindow.registerPixelUpdates) {
        definedSetter = true;
        Object.defineProperty(unsafeWindow, 'registerPixelUpdates', {
            set: (v) => {
                definedSetter = false;
                delete unsafeWindow.registerPixelUpdates;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- workaround if events not initialized yet
                unsafeWindow.registerPixelUpdates = v;
                subscriber.next(unsafeWindow.registerPixelUpdates);
                subscriber.complete();
            },
            configurable: true,
        });
        return;
    } else {
        subscriber.next(unsafeWindow.registerPixelUpdates);
        subscriber.complete();
    }

    return () => {
        if (definedSetter) {
            delete unsafeWindow.registerPixelUpdates;
        }
    };
}).pipe(
    shareReplay({
        bufferSize: 1,
        // Need to add refCount, otherwise it will not unsubscribe from inner obs even when no listeners are left
        refCount: true,
    })
);

const pixelPlanetEventsObs = signalToObs(pixelPlanetEvents);

function createPixelPlanetEventObservable<Key extends keyof PixelPlanetEventTypes>(key: Key) {
    return pixelPlanetEventsObs.pipe(
        switchMap((e) => {
            return new Observable<PixelPlanetEventTypes[Key]>((subscriber) => {
                const handleEvent = (...args: PixelPlanetEventTypes[Key]) => {
                    subscriber.next(args);
                };
                // @ts-expect-error don't know how to fix this this type miss-match, key of PixelPlanetEventTypes should work
                e.on(key, handleEvent);
                // @ts-expect-error don't know how to fix this this type miss-match, key of PixelPlanetEventTypes should work
                return () => e.off(key, handleEvent);
            });
        })
    );
}

const viewCoordinatesEventObs = createPixelPlanetEventObservable('setviewcoordinates');
export const viewCenterObs = viewCoordinatesEventObs.pipe(
    map((value) => ({
        x: value[0][0],
        y: value[0][1],
    }))
);
const scaleEventObs = createPixelPlanetEventObservable('setscale');
export const viewScaleObs = scaleEventObs.pipe(map((value) => value[0]));

function getViewScaleFromUrl(hash: string) {
    // "#d,0,0,15"
    const splitStr = decodeURIComponent(hash).substring(1).split(',');
    // TODO ignore 3D
    if (!splitStr[3]) return 3; // default to 3
    let z = parseInt(splitStr[3], 10);
    z = 2 ** (z / 10);
    return z;
}
const locationHashObs = locationHrefObs.pipe(map((hrefUrl) => hrefUrl.hash));
const viewScaleLocationFallbackObs = locationHashObs.pipe(map((hash) => getViewScaleFromUrl(hash)));
const viewScaleLocationFallbackSignal = obsToSignal(viewScaleLocationFallbackObs, () => getViewScaleFromUrl(location.hash));
const viewScaleEventSignal = obsToSignal(viewScaleObs);
export const viewScaleSignal = createSignalComputed(() => {
    const eventValue = viewScaleEventSignal.get();
    if (!eventValue) return viewScaleLocationFallbackSignal.get();
    return eventValue;
});

const currentCanvasEventObs = createPixelPlanetEventObservable('selectcanvas');
export const currentCanvasIdObs = currentCanvasEventObs.pipe(map((value) => value[0]));
const hoverEventObs = createPixelPlanetEventObservable('sethover');
export const viewHoverObs = hoverEventObs.pipe(
    map((value) => ({
        x: value[0][0],
        y: value[0][1],
    }))
);
const receiveChunkEventObs = createPixelPlanetEventObservable('receivechunk');
export const receiveChunkObs = receiveChunkEventObs.pipe(map((value) => value[0]));
const pixelUpdateSharedObs = registerPixelUpdatesObs.pipe(
    switchMap(
        (registerPixelUpdates) =>
            new Observable<Parameters<Parameters<NonNullable<typeof window.registerPixelUpdates>>[0]>>((subscriber) => {
                // TODO, only 1 extension currently can be registered, new registration will override previous extension
                let handleEvent = (chunkI: number, chunkJ: number, pixelsOffsetInChunkAndColor: [number, number][]) => {
                    subscriber.next([chunkI, chunkJ, pixelsOffsetInChunkAndColor]);
                };
                const handleEventWrapper = (chunkI: number, chunkJ: number, pixelsOffsetInChunkAndColor: [number, number][]) => {
                    handleEvent(chunkI, chunkJ, pixelsOffsetInChunkAndColor);
                };
                registerPixelUpdates(handleEventWrapper);
                return () => {
                    // there is no unregister api currently
                    handleEvent = () => undefined;
                };
            })
    ),
    share()
);

export const pixelUpdateObs = pixelUpdateSharedObs.pipe(
    map((pixelUpdate) => ({
        chunkI: pixelUpdate[0],
        chunkJ: pixelUpdate[1],
        pixels: pixelUpdate[2].map((p) => ({
            offset: p[0],
            color: p[1],
        })),
    }))
);

const templateLoaderSignal = createSignalState(unsafeWindow.templateLoader, (s) => {
    let definedSetter = false;
    if (!unsafeWindow.templateLoader) {
        definedSetter = true;
        Object.defineProperty(unsafeWindow, 'templateLoader', {
            set: (v) => {
                definedSetter = false;
                delete unsafeWindow.templateLoader;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- workaround if objects not initialized yet
                unsafeWindow.templateLoader = v;
                s.set(unsafeWindow.templateLoader);
            },
            configurable: true,
        });
        return;
    }

    queueMicrotask(() => {
        if (!s.get()) {
            s.set(unsafeWindow.templateLoader);
        }
    });

    return () => {
        if (definedSetter) {
            delete unsafeWindow.templateLoader;
        }
    };
});

const templateLoaderReadySignal = createSignalComputedNested(() => {
    const templateLoader = templateLoaderSignal.get();
    if (!templateLoader) return;
    if (templateLoader.ready) return templateLoader;
    let definedSetter = false;
    return createSignalState<typeof templateLoader | undefined>(undefined, (s) => {
        Object.defineProperty(templateLoader, 'ready', {
            set: (v) => {
                definedSetter = false;
                // @ts-expect-error remove our created Object.defineProperty
                delete templateLoader.ready;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- workaround if objects not initialized yet
                templateLoader.ready = v;
                s.set(templateLoader);
            },
            configurable: true,
        });

        return () => {
            if (definedSetter) {
                // @ts-expect-error remove our created Object.defineProperty
                delete templateLoader.ready;
                templateLoader.ready = false;
            }
        };
    });
});

function getViewCenterFromUrl(hash: string) {
    // "#d,0,0,15"
    const splitStr = decodeURIComponent(hash).substring(1).split(',');
    // TODO ignore 3D
    const x = splitStr[1] == null ? undefined : parseInt(splitStr[1]);
    const y = splitStr[2] == null ? undefined : parseInt(splitStr[2]);
    if (x == null || isNaN(x) || y == null || isNaN(y)) return { x: 0, y: 0 }; // default to 0,0
    return {
        x,
        y,
    };
}

const viewCenterLocationFallbackObs = locationHashObs.pipe(map((hash) => getViewCenterFromUrl(hash)));
const viewCenterLocationFallbackSignal = obsToSignal(viewCenterLocationFallbackObs, () => getViewCenterFromUrl(location.hash));
const viewCenterEventSignal = obsToSignal(viewCenterObs);
export const viewCenterSignal = createSignalComputed(() => {
    const eventValue = viewCenterEventSignal.get();
    if (!eventValue) return viewCenterLocationFallbackSignal.get();
    return eventValue;
});

interface ChunkFromEvent {
    recUpdates: boolean;
    timestamp: number;
    z: number;
    i: number;
    j: number;
    image: HTMLCanvasElement;
    ready: boolean;
    isEmpty: boolean;
    palette: {
        length: number;
        rgb: Record<string, number>;
        colors: string[];
        abgr: Record<string, number>;
        fl: [[number, number, number]];
    };
}

interface PixelPlanetEventTypes {
    setviewcoordinates: [[number, number]];
    setscale: [number];
    selectcanvas: [string];
    sethover: [[number, number]];
    receivechunk: [ChunkFromEvent];
}

interface ExportableTemplate {
    buffer: string;
    canvasId: string;
    enabled: boolean;
    height: number;
    imageId: number;
    mimetype: string;
    title: string;
    width: number;
    x: number;
    y: number;
}

interface ReduxTemplate {
    canvasId: string;
    enabled: boolean;
    height: number;
    imageId: number;
    title: string;
    width: number;
    x: number;
    y: number;
}

interface InternalTemplate {
    image: HTMLCanvasElement;
    id: number;
    width: number;
    height: number;
    ready: boolean;
    readonly imageSmall: boolean;
    arrayBuffer: () => Promise<ArrayBuffer>;
    setDimensionFromCanvas: () => [number, number];
    fromImage: (img: HTMLImageElement) => [number, number];
    fromFile: (file: File) => Promise<[number, number]>;
    /**
     *
     * @param type default 'image/png'
     */
    fromBuffer: (buffer: ArrayBuffer, type?: string) => Promise<[number, number]>;
}

declare global {
    interface Window {
        pixelPlanetEvents?: EventEmitter<PixelPlanetEventTypes>;
        registerPixelUpdates?: (cb: (chunkI: number, chunkJ: number, pixelOffsetAndColor: [number, number][]) => void) => void;
        templateLoader?: {
            ready: boolean;

            initialize(store: { getState: () => PageState }): Promise<void>;

            getTemplate(id: number): Promise<HTMLCanvasElement | null>;

            getTemplateSync(id: number): HTMLCanvasElement | null;

            getSmallTemplateSync(id: number): boolean | null;

            getColorOfPixel(canvasId: string, x: number, y: number): [number, number, number] | null;

            getTemplatesInView(canvasId: string, x: number, y: number, horizontalRadius: number, verticalRadius: number): ReduxTemplate[];

            syncDB(): Promise<void>;

            loadAllMissing(): Promise<void>;

            loadExistingTemplate(imageId: number): Promise<InternalTemplate | null>;

            /**
             * Create new template.
             */
            addFile(file: File, title: string, canvasId: string, x: number, y: number): Promise<void>;

            updateFile(imageId: number, file: File): Promise<void>;

            changeTemplate(title: string, props: Partial<{ imageId: number; enabled: boolean; title: string; canvasId: string; x: number; y: number; width: number; height: number }>): void;

            /**
             * Delete template by title.
             */
            deleteTemplate(title: string): void;

            /**
             * Export enabled templates.
             * Only allowed to export when at least 1 is enabled, and no more than 20.
             */
            exportEnabledTemplates(): Promise<ExportableTemplate[] | null>;

            /**
             * Import saved templates.
             * @param file Text file containing templates ExportableTemplate[]
             */
            importTemplates(file: File): Promise<void>;
        };
    }
}
