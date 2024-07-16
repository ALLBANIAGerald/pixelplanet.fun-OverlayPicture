import { Store } from 'redux';

import { createSignalComputedNested } from './signalPrimitives/createSignalComputedNested';
import { createSignalComputed, createSignalState } from './signalPrimitives/createSignal';

function isStoreFromRedux(store: any) {
    if (typeof store !== 'object') return false;
    if (!store.dispatch) return false;
    if (!store.getState) return false;
    if (!store.subscribe) return false;
    return true;
}

function getStoreFromReactInternalEl(el: any): Store<PageState> | undefined {
    if (el.tag !== 0 || !el.child) return undefined;
    if (el.child.tag !== 10) return undefined;
    if (!el.child.memoizedProps) return undefined;
    const childStore = el.child.memoizedProps?.value?.store;
    if (!isStoreFromRedux(childStore)) return undefined;
    const parentStore = el.memoizedProps?.store;
    if (!isStoreFromRedux(parentStore)) return undefined;
    if (childStore !== parentStore) return undefined;
    return parentStore;
}

function findReactRootContainerEl() {
    return document.getElementById('app');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getReactContainer(el: HTMLElement): any {
    const reactContainerName = Object.keys(el).filter((k) => k.startsWith('__reactContainer'))[0];
    if (!reactContainerName) return undefined;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const root = (el as any)[reactContainerName];
    return root;
}

function findStoreInRoot(el: HTMLElement) {
    const root = getReactContainer(el);
    if (!root) return undefined;
    let checkedReactInternalElement = root;
    while (checkedReactInternalElement.child) {
        const store = getStoreFromReactInternalEl(checkedReactInternalElement);
        if (store) return store;
        checkedReactInternalElement = checkedReactInternalElement.child;
    }
    return undefined;
}

export function findPageReduxStore(): Store<PageState> {
    const reactRootEl = findReactRootContainerEl();
    if (!reactRootEl) throw new Error("Couldn't find React root container");
    const store = findStoreInRoot(reactRootEl);
    if (!store) throw new Error("Couldn't find Redux store");
    return store;
}

const reactRootElSignal = createSignalState(findReactRootContainerEl(), (s) => {
    return () => {
        let observer: MutationObserver | undefined;
        queueMicrotask(() => {
            const reactRootEl = s.get();
            if (!reactRootEl) {
                const rootEl = findReactRootContainerEl();
                if (rootEl) {
                    s.set(rootEl);
                    return;
                }
                observer = new MutationObserver(() => {
                    const rootEl = findReactRootContainerEl();
                    if (rootEl) {
                        observer?.disconnect();
                        reactRootElSignal.set(rootEl);
                    }
                });
                observer.observe(document, { subtree: true });
            }
        });

        return () => {
            observer?.disconnect();
        };
    };
});

const pageReduxStoreSignal = createSignalComputedNested(() => {
    const rootEl = reactRootElSignal.get();
    if (!rootEl) return createSignalState({ type: 'loading' } as const);
    return createSignalState<{ type: 'success'; store: Store<PageState> } | { type: 'loading' } | { type: 'error'; error: 'window not accessible' }>({ type: 'loading' }, (s) => {
        let observer: MutationObserver | undefined;
        const store = findStoreInRoot(rootEl);
        if (store) {
            queueMicrotask(() => {
                s.set({ type: 'success', store });
            });
            return;
        }
        if (rootEl.childElementCount === 0) {
            // React has not loaded yet, wait for React to initialize
            observer = new MutationObserver(() => {
                const foundStore = findStoreInRoot(rootEl);
                if (!foundStore) return;
                observer?.disconnect();
                s.set({ type: 'success', store: foundStore });
            });
            observer.observe(rootEl, { childList: true, subtree: true });
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (!getReactContainer(rootEl).child) {
                // React has not loaded it's internals yet
                setTimeout(() => {
                    const store = findStoreInRoot(rootEl);
                    if (store) s.set({ type: 'success', store });
                    else s.set({ type: 'error', error: 'window not accessible' });
                }, 1000);
            } else {
                // We don't have direct access page's `window` instance
                s.set({ type: 'error', error: 'window not accessible' });
            }
        }
        return () => {
            observer?.disconnect();
            observer = undefined;
        };
    });
});

type TypedUseSelectorHookWithUndefined<TState> = <TSelected>(selector: (state: TState) => TSelected, equalityFn?: (left: TSelected, right: TSelected) => boolean) => TSelected | undefined;

/**
 * Hacky useSelector hook to work for the custom page store
 */
// export const usePageReduxStoreSelector: TypedUseSelectorHookWithUndefined<PageState> = (selector) => {
//     const store = useSignal(pageReduxStoreSignal);
//     const [selectedResult, setSelectedResult] = useState<ReturnType<typeof selector>>();
//     useEffect(() => {
//         if (store.type !== 'success') return undefined;

//         setSelectedResult(selector(store.store.getState()));

//         const unsubscribe = store.store.subscribe(() => {
//             setSelectedResult(selector(store.store.getState()));
//         });

//         return () => unsubscribe();
//     }, [store, selector]);
//     return selectedResult;
// };

// export const usePageReduxStoreDispatch = () => {
//     const store = useSignal(pageReduxStoreSignal);
//     if (store.type !== 'success') return undefined;
//     return store.store.dispatch;
// };

export function pageReduxStoreSelectColorAction(colorIndex: number) {
    return {
        type: 'SELECT_COLOR',
        color: colorIndex,
    };
}

export function setViewCoordinates(view: [number, number]) {
    return {
        type: 'SET_VIEW_COORDINATES',
        view,
    };
}

const latestStateSignal = createSignalComputedNested(() => {
    const store = pageReduxStoreSignal.get();
    if (store.type !== 'success') return createSignalComputed<PageState | undefined>(() => undefined);
    return createSignalState<PageState | undefined>(undefined, (s) => {
        const unsub = store.store.subscribe(() => {
            s.set(store.store.getState());
        });
        return () => {
            unsub();
        };
    });
});

export const selectPageStatePixelWaitDate = createSignalComputed(() => latestStateSignal.get()?.user.wait);

export const selectPageStateCurrentSelectedColor = createSignalComputed(() => {
    const state = latestStateSignal.get();
    return state?.canvas.selectedColor ?? 0;
});

export const selectPageStateHoverPixel = createSignalComputed(() => {
    const state = latestStateSignal.get();
    const x = state?.canvas.hover?.[0];
    const y = state?.canvas.hover?.[1];
    if (x == null || y == null) return undefined;
    return { x, y };
});

export const selectPageStateCanvasViewCenter = createSignalComputed(() => {
    const state = latestStateSignal.get();
    const x = state?.canvas.view[0];
    const y = state?.canvas.view[1];
    if (x == null || y == null) return undefined;
    return { x, y };
});

export const selectPageStateRoundedCanvasViewCenter = createSignalComputed(() => {
    const view = selectPageStateCanvasViewCenter.get();
    if (!view) return undefined;
    return { x: Math.round(view.x), y: Math.round(view.y) };
});

export const selectPageStateCanvasPalette = createSignalComputed(() => {
    const state = latestStateSignal.get();
    const paletteAbgr = state?.canvas.palette.abgr ?? [];
    return Array.from(new Uint32Array(paletteAbgr)).map<[number, number, number]>((abgr) => {
        // eslint-disable-next-line no-bitwise
        const b = (abgr & 0x00ff0000) >>> 16;
        // eslint-disable-next-line no-bitwise
        const g = (abgr & 0x0000ff00) >>> 8;
        // eslint-disable-next-line no-bitwise
        const r = abgr & 0x000000ff;
        return [r, g, b];
    });
});

export const selectPageStateCanvasReservedColors = createSignalComputed(() => {
    const state = latestStateSignal.get();
    return state?.canvas.clrIgnore ?? 0;
});

export const selectPageStateCanvasId = createSignalComputed(() => {
    const state = latestStateSignal.get();
    return state?.canvas.canvasId ?? '0';
});

export const selectPageStateCanvasSize = createSignalComputed(() => {
    const state = latestStateSignal.get();
    return state?.canvas.canvasSize ?? 1;
});

const currentCanvas = createSignalComputed(() => {
    const state = latestStateSignal.get();
    return state?.canvas.canvases[state.canvas.canvasId];
});

export const selectPageStateCanvasMaxTimeoutMs = createSignalComputed(() => {
    const canvas = currentCanvas.get();
    return canvas?.cds ?? 100;
});

export const selectPageStateCanvasTimeoutOnBaseMs = createSignalComputed(() => {
    const canvas = currentCanvas.get();
    return canvas?.bcd ?? 100;
});

export const selectPaseStateCanvasTimeoutOnPlacedMs = createSignalComputed(() => {
    const canvas = currentCanvas.get();
    return canvas?.pcd ?? 100;
});

export interface PageState {
    audio: Audio;
    canvas: Canvas;
    gui: GUI;
    windows: Windows;
    user: User;
    ranks: Ranks;
    alert: Alert;
    chat: Chat;
    contextMenu: ContextMenu;
    chatRead: ChatRead;
    fetching: Fetching;
    _persist: Persist;
}

export interface Persist {
    version: number;
    rehydrated: boolean;
}

export interface Alert {
    alertOpen: boolean;
    alertType: null;
    alertTitle: null;
    alertMessage: null;
    alertBtn: null;
}

export interface Audio {
    mute: boolean;
    chatNotify: boolean;
}

export interface Canvas {
    canvasId: string;
    canvasIdent: string;
    canvasSize: number;
    historicalCanvasSize: number;
    is3D: boolean;
    canvasStartDate: Date;
    canvasMaxTiledZoom: number;
    palette: Palette;
    clrIgnore: number;
    selectedColor: number;
    view: number[];
    scale: number;
    canvases: Record<string, Canvase>;
    isHistoricalView: boolean;
    historicalDate: null;
    historicalTime: null;
    hover: number[] | null;
    showHiddenCanvases: boolean;
    prevCanvasCoords: PrevCanvasCoords;
}

export interface Canvase {
    ident: string;
    colors: number[][];
    size: number;
    cli?: number;
    bcd: number;
    pcd?: number;
    cds: number;
    ranked?: boolean;
    sd: string;
    desc: string;
    title: string;
    historicalSizes?: (number | string)[][];
    req?: number | string;
    v?: boolean;
    hid?: boolean;
}

export interface Palette {
    length: number;
    rgb: Uint8Array;
    colors: string[];
    abgr: Uint32Array;
    fl: [number, number, number][];
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PrevCanvasCoords {}

export interface Chat {
    channels: Record<string, (number | string)[]>;
    blocked: any[];
    messages: PrevCanvasCoords;
}

export interface ChatRead {
    mute: any[];
    readTs: Record<string, number>;
    unread: Record<string, boolean>;
    chatChannel: number;
}

export interface ContextMenu {
    menuOpen: boolean;
    menuType: null;
    xPos: number;
    yPos: number;
    args: PrevCanvasCoords;
}

export interface Fetching {
    fetchingChunks: number;
    fetchingChat: boolean;
    fetchinApi: boolean;
}

export interface GUI {
    showGrid: boolean;
    showPixelNotify: boolean;
    autoZoomIn: boolean;
    isPotato: boolean;
    isLightGrid: boolean;
    compactPalette: boolean;
    paletteOpen: boolean;
    menuOpen: boolean;
    onlineCanvas: boolean;
    style: string;
    pixelsPlaced: number;
    chatChannel: number;
}

export interface Ranks {
    totalPixels: number;
    dailyTotalPixels: number;
    ranking: null;
    dailyRanking: null;
    online: Online;
    totalRanking: TotalRanking[];
    totalDailyRanking: TotalRanking[];
}

export interface Online {
    '0': number;
    '1': number;
    '2': number;
    '3': number;
    '7': number;
    '8': number;
    total: number;
}

export interface TotalRanking {
    id: number;
    name: string;
    totalPixels: number;
    ranking: number;
    dailyRanking: number;
    dailyTotalPixels: number;
    age: number;
}

export interface User {
    id: null;
    name: null;
    wait: Date | null;
    coolDown: null;
    lastCoolDownEnd: null;
    requestingPixel: boolean;
    messages: any[];
    mailreg: boolean;
    blockDm: boolean;
    isOnMobile: boolean;
    notification: null;
    userlvl: number;
}

export interface Windows {
    showWindows: boolean;
    zMax: number;
    modal: Modal;
    windows: any[];
    args: PrevCanvasCoords;
}

export interface Modal {
    windowType: null;
    title: null;
    open: boolean;
    prevWinSize: PrevCanvasCoords;
}
