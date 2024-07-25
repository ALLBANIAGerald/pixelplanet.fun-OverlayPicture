import { PageState, selectPageStateCanvases, selectPageStateCanvasId, selectPageStateCanvasPalette, selectPageStateCanvasReservedColors } from '../../utils/getPageReduxStore';
import { unsafeWindow } from 'vite-plugin-monkey/dist/client';
import { createSignalComputed } from '../../utils/signalPrimitives/createSignal';
import { combineLatestWith, distinctUntilChanged, filter, fromEvent, map, Observable, raceWith, share, shareReplay, switchMap, take } from 'rxjs';
import { EventEmitter } from 'events';
import { obsToSignal, signalToObs } from '../obsToSignal';
import { locationHrefObs } from '../../utils/signalPrimitives/locationHref';
import { viewPortSignal } from '../../gameInjection/viewport';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';

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

const pixelPlanetEventsObs = new Observable<NonNullable<typeof unsafeWindow.pixelPlanetEvents>>((subscriber) => {
    let definedSetter = false;
    if (!unsafeWindow.pixelPlanetEvents) {
        definedSetter = true;
        Object.defineProperty(unsafeWindow, 'pixelPlanetEvents', {
            set: (v: typeof unsafeWindow.pixelPlanetEvents) => {
                definedSetter = false;
                delete unsafeWindow.pixelPlanetEvents;
                unsafeWindow.pixelPlanetEvents = v;
                subscriber.next(unsafeWindow.pixelPlanetEvents);
                subscriber.complete();
            },
            configurable: true,
        });
    } else {
        subscriber.next(unsafeWindow.pixelPlanetEvents);
        subscriber.complete();
        return;
    }

    return () => {
        if (definedSetter) {
            delete unsafeWindow.pixelPlanetEvents;
        }
    };
}).pipe(shareReplay({ bufferSize: 1, refCount: true }));

const registerPixelUpdatesObs = new Observable<NonNullable<typeof unsafeWindow.registerPixelUpdates>>((subscriber) => {
    let definedSetter = false;
    if (!unsafeWindow.registerPixelUpdates) {
        definedSetter = true;
        Object.defineProperty(unsafeWindow, 'registerPixelUpdates', {
            set: (v: typeof unsafeWindow.registerPixelUpdates) => {
                definedSetter = false;
                delete unsafeWindow.registerPixelUpdates;
                unsafeWindow.registerPixelUpdates = v;
                subscriber.next(unsafeWindow.registerPixelUpdates);
                subscriber.complete();
            },
            configurable: true,
        });
    } else {
        subscriber.next(unsafeWindow.registerPixelUpdates);
        subscriber.complete();
        return;
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

function createPixelPlanetEventObservable<Key extends keyof PixelPlanetEventTypes>(key: Key) {
    return pixelPlanetEventsObs.pipe(
        switchMap((e) => fromEvent(e, key)),
        map((v) => v as PixelPlanetEventTypes[Key][0])
    );
}

export const viewCenterObs = createPixelPlanetEventObservable('setviewcoordinates').pipe(
    map((value) => ({
        x: value[0],
        y: value[1],
    })),
    shareReplay({ bufferSize: 1, refCount: true })
);
export const viewScaleObs = createPixelPlanetEventObservable('setscale').pipe(
    map((value) => value),
    shareReplay({ bufferSize: 1, refCount: true })
);

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
const viewScaleLocationFallbackObs = locationHashObs.pipe(
    map((hash) => getViewScaleFromUrl(hash)),
    distinctUntilChanged()
);
const viewScaleLocationFallbackSignal = obsToSignal(viewScaleLocationFallbackObs, () => getViewScaleFromUrl(location.hash));
const viewScaleEventSignal = obsToSignal(viewScaleObs);
export const viewScaleSignal = createSignalComputed(() => {
    const eventValue = viewScaleEventSignal.get();
    if (!eventValue) return viewScaleLocationFallbackSignal.get();
    return eventValue;
});
function getCanvasIdentFromUrl(hash: string) {
    // "#d,0,0,15"
    const splitStr = decodeURIComponent(hash).substring(1).split(',');
    // TODO ignore 3D
    return splitStr[0];
}
const canvasIdentFromUrlObs = locationHashObs.pipe(
    map(getCanvasIdentFromUrl),
    filter((i) => i !== undefined)
);
const pageStateCanvasesObs = signalToObs(selectPageStateCanvases).pipe(filter((x) => x !== undefined));
const canvasIdFromUrlObs = canvasIdentFromUrlObs.pipe(
    switchMap((ident) =>
        pageStateCanvasesObs.pipe(
            map((can) => Object.entries(can).find(([, c]) => c.ident === ident)?.[0]),
            filter((x) => x !== undefined)
        )
    )
);
const fallbackCanvasIdObs = signalToObs(selectPageStateCanvasId).pipe(
    filter((c) => c !== undefined),
    take(1)
);
export const currentCanvasIdObs = createPixelPlanetEventObservable('selectcanvas').pipe(
    raceWith(canvasIdFromUrlObs.pipe(take(1)), fallbackCanvasIdObs),
    shareReplay({ bufferSize: 1, refCount: true })
);
export const viewHoverObs = createPixelPlanetEventObservable('sethover').pipe(
    map((value) => ({
        x: value[0],
        y: value[1],
    })),
    shareReplay({ bufferSize: 1, refCount: true })
);
export const receiveChunkObs = createPixelPlanetEventObservable('receivechunk');
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

const templateLoaderObs = new Observable<NonNullable<typeof unsafeWindow.templateLoader>>((subscriber) => {
    if (unsafeWindow.templateLoader) {
        subscriber.next(unsafeWindow.templateLoader);
        subscriber.complete();
        return;
    }

    let definedSetter = true;
    Object.defineProperty(unsafeWindow, 'templateLoader', {
        set: (v: typeof unsafeWindow.templateLoader) => {
            definedSetter = false;
            delete unsafeWindow.templateLoader;
            unsafeWindow.templateLoader = v;
            subscriber.next(unsafeWindow.templateLoader);
            subscriber.complete();
        },
        configurable: true,
    });
    return () => {
        if (definedSetter) {
            delete unsafeWindow.templateLoader;
        }
    };
}).pipe(shareReplay({ bufferSize: 1, refCount: true }));

export const templateLoaderReadyObs = templateLoaderObs
    .pipe(
        switchMap(
            (templateLoader) =>
                new Observable<typeof templateLoader>((subscriber) => {
                    if (templateLoader.ready) {
                        subscriber.next(templateLoader);
                        subscriber.complete();
                        return;
                    }

                    let definedSetter = true;
                    Object.defineProperty(templateLoader, 'ready', {
                        get: () => false,
                        set: (v: boolean) => {
                            definedSetter = false;
                            // @ts-expect-error remove our created Object.defineProperty
                            delete templateLoader.ready;
                            templateLoader.ready = v;
                            subscriber.next(templateLoader);
                            subscriber.complete();
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
                })
        )
    )
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));

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

const viewportObsOptional = signalToObs(viewPortSignal);
const viewportObs = viewportObsOptional.pipe(
    filter((v) => !!v),
    shareReplay({ bufferSize: 1, refCount: true })
);

function resizeObservable(elem: HTMLElement) {
    return new Observable<ResizeObserverEntry[]>((subscriber) => {
        const ro = new ResizeObserver((entries) => {
            subscriber.next(entries);
        });

        ro.observe(elem);
        return function unsubscribe() {
            ro.unobserve(elem);
        };
    });
}

const viewportSizeObs = viewportObs.pipe(
    switchMap((v) => resizeObservable(v)),
    map((e) => (e[0]?.borderBoxSize[0] ? { height: e[0].borderBoxSize[0].blockSize, width: e[0].borderBoxSize[0].inlineSize } : undefined)),
    filter((e) => !!e),
    shareReplay({ bufferSize: 1, refCount: true })
);

export const templatesIdsInViewObs = templateLoaderReadyObs.pipe(
    combineLatestWith(currentCanvasIdObs, viewportSizeObs, viewCenterObs),
    map(([templateLoader, currentCanvasId, viewportSize, viewCenter]) =>
        templateLoader.getTemplatesInView(currentCanvasId, viewCenter.x, viewCenter.y, viewportSize.width / 2, viewportSize.height / 2)
    ),
    map((x) => new Set(x.map((t) => t.imageId))),
    distinctUntilChanged((prev, curr) => prev.symmetricDifference(curr).size === 0),
    shareReplay({ bufferSize: 1, refCount: true })
);

const viewportSizeOptionalSignal = obsToSignal(viewportSizeObs);
export const viewportSizeSignal = createSignalComputed(() => {
    const viewportSize = viewportSizeOptionalSignal.get();
    if (viewportSize) return viewportSize;
    return windowInnerSize.get();
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
