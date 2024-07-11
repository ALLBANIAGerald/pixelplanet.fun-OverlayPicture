import { useEffect, useState } from 'react';
import { AnyAction, Store } from 'redux';
import { Signal } from 'signal-polyfill';
import { useSignal } from 'store/store';

import { createSelector } from '@reduxjs/toolkit';

function isStoreFromRedux(store: any) {
    if (typeof store !== 'object') return false;
    if (!store.dispatch) return false;
    if (!store.getState) return false;
    if (!store.subscribe) return false;
    return true;
}

function getStoreFromReactInternalEl(el: any): Store<PageState, AnyAction> | undefined {
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

function findStoreInRoot(el: HTMLElement) {
    const reactContainerName = Object.keys(el).filter((k) => k.startsWith('__reactContainer'))[0];
    if (!reactContainerName) return undefined;

    const root = (el as any)[reactContainerName];
    let checkedReactInternalElement = root;
    while (checkedReactInternalElement.child) {
        const store = getStoreFromReactInternalEl(checkedReactInternalElement);
        if (store) return store;
        checkedReactInternalElement = checkedReactInternalElement.child;
    }
    return undefined;
}

export function findPageReduxStore(): Store<PageState, AnyAction> {
    const reactRootEl = findReactRootContainerEl();
    if (!reactRootEl) throw new Error("Couldn't find React root container");
    const store = findStoreInRoot(reactRootEl);
    if (!store) throw new Error("Couldn't find Redux store");
    return store;
}

const reactRootEl = findReactRootContainerEl();
if (!reactRootEl) {
    const observer = new MutationObserver(() => {
        const rootEl = findReactRootContainerEl();
        if (rootEl) {
            observer.disconnect();
            reactRootElSignal.set(rootEl);
        }
    });
    observer.observe(document, { subtree: true });
}
const reactRootElSignal = new Signal.State(reactRootEl);

function createPageReduxStoreSignal(rootEl: HTMLElement) {
    let observer: MutationObserver | undefined;
    const pageReduxStoreSignal = new Signal.State<{ type: 'success'; store: Store<PageState, AnyAction> } | { type: 'loading' } | { type: 'error'; error: 'window not accessible' }>(
        { type: 'loading' },
        {
            [Signal.subtle.watched]: () => {
                const store = findStoreInRoot(rootEl);
                if (store) {
                    pageReduxStoreSignal.set({ type: 'success', store });
                    return;
                }
                if (rootEl.childElementCount === 0) {
                    // React has not loaded yet, wait for React to initialize
                    observer = new MutationObserver(() => {
                        if (rootEl) {
                            const foundStore = findStoreInRoot(rootEl);
                            if (!foundStore) return;
                            observer?.disconnect();
                            pageReduxStoreSignal.set({ type: 'success', store: foundStore });
                        }
                    });
                    observer.observe(rootEl, { subtree: true });
                } else {
                    // We probably don't have direct access page's `window` instance
                    pageReduxStoreSignal.set({ type: 'error', error: 'window not accessible' });
                }
            },
            [Signal.subtle.unwatched]: () => {
                observer?.disconnect();
                observer = undefined;
            },
        }
    );
    return pageReduxStoreSignal;
}

const pageReduxStoreNestedSignal = new Signal.Computed(() => {
    const rootEl = reactRootElSignal.get();
    if (!rootEl) return new Signal.Computed(() => ({ type: 'loading' } as const));
    return createPageReduxStoreSignal(rootEl);
});

export const pageReduxStoreSignal = new Signal.Computed(() => {
    const nested = pageReduxStoreNestedSignal.get();
    return nested.get();
});

interface TypedUseSelectorHookWithUndefined<TState> {
    <TSelected>(selector: (state: TState) => TSelected, equalityFn?: (left: TSelected, right: TSelected) => boolean): TSelected | undefined;
}

/**
 * Hacky useSelector hook to work for the custom page store
 */
export const usePageReduxStoreSelector: TypedUseSelectorHookWithUndefined<PageState> = (selector) => {
    const store = useSignal(pageReduxStoreSignal);
    const [selectedResult, setSelectedResult] = useState<ReturnType<typeof selector>>();
    useEffect(() => {
        if (store.type !== 'success') return undefined;

        setSelectedResult(selector(store.store.getState()));

        const unsubscribe = store.store.subscribe(() => {
            setSelectedResult(selector(store.store.getState()));
        });

        return () => unsubscribe();
    }, [store, selector]);
    return selectedResult;
};

export const usePageReduxStoreDispatch = () => {
    const store = useSignal(pageReduxStoreSignal);
    if (store.type !== 'success') return undefined;
    return store.store.dispatch;
};

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

function createLatestStateSignal(store: Store<PageState, AnyAction>) {
    let unsub: (() => void) | undefined;
    const latestState = new Signal.State<PageState | undefined>(undefined, {
        [Signal.subtle.watched]: () => {
            unsub = store.subscribe(() => {
                latestState.set(store.getState());
            });
        },
        [Signal.subtle.unwatched]: () => unsub?.(),
    });
    return latestState;
}

const latestStateNestedSignal = new Signal.Computed(() => {
    const store = pageReduxStoreSignal.get();
    if (store.type !== 'success') return new Signal.Computed<PageState | undefined>(() => undefined);
    return createLatestStateSignal(store.store);
});

const latestStateSignal = new Signal.Computed(() => {
    const nested = latestStateNestedSignal.get();
    return nested.get();
});

export const selectPageStatePixelWaitDate = new Signal.Computed(() => latestStateSignal.get()?.user.wait);

export const selectPageStateCurrentSelectedColor = createSelector(
    (state: PageState) => state.canvas.selectedColor,
    (currentSelectedColor) => currentSelectedColor
);

export const selectPageStateHoverPixel = new Signal.Computed(() => {
    const state = latestStateSignal.get();
    const x = state?.canvas.hover?.[0];
    const y = state?.canvas.hover?.[1];
    if (x == null || y == null) return undefined;
    return { x, y };
});

export const selectPageStateViewScale = createSelector(
    (state: PageState) => state.canvas.view[2],
    (viewScale) => viewScale
);

export const selectPageStateCanvasViewCenter = new Signal.Computed(() => {
    const state = latestStateSignal.get();
    const x = state?.canvas.view?.[0];
    const y = state?.canvas.view?.[1];
    if (x == null || y == null) return undefined;
    return { x, y };
});

export const selectPageStateRoundedCanvasViewCenter = new Signal.Computed(() => {
    const view = selectPageStateCanvasViewCenter.get();
    if (!view) return undefined;
    return { x: Math.round(view.x), y: Math.round(view.y) };
});

export const selectPageStateCanvasPalette = new Signal.Computed(() => {
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

export const selectPageStateCanvasReservedColors = createSelector(
    (state: PageState) => state.canvas.clrIgnore,
    (reservedColors) => reservedColors
);

export const selectPageStateCanvasId = createSelector(
    (state: PageState) => state.canvas.canvasId,
    (canvasId) => canvasId
);

export const selectPageStateCanvasSize = createSelector(
    (state: PageState) => state.canvas.canvasSize,
    (size) => size
);

export const selectPageStateCanvasMaxTimeoutMs = createSelector(
    (state: PageState) => state.canvas.canvases[state.canvas.canvasId]?.cds,
    (canvasMaxTimeout) => canvasMaxTimeout
);

export const selectPageStateCanvasTimeoutOnBaseMs = createSelector(
    (state: PageState) => state.canvas.canvases[state.canvas.canvasId]?.bcd,
    (canvasTimeoutOnBase) => canvasTimeoutOnBase
);

export const selectPaseStateCanvasTimeoutOnPlacedMs = createSelector(
    (state: PageState) => state.canvas.canvases[state.canvas.canvasId]?.pcd,
    (canvasTimeoutOnPlaced) => canvasTimeoutOnPlaced
);

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
    canvasId: number;
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
    canvases: { [key: number]: Canvase };
    isHistoricalView: boolean;
    historicalDate: null;
    historicalTime: null;
    hover: number[] | null;
    showHiddenCanvases: boolean;
    prevCanvasCoords: PrevCanvasCoords;
}

export interface Canvase {
    ident: string;
    colors: Array<number[]>;
    size: number;
    cli?: number;
    bcd: number;
    pcd?: number;
    cds: number;
    ranked?: boolean;
    sd: string;
    desc: string;
    title: string;
    historicalSizes?: Array<Array<number | string>>;
    req?: number | string;
    v?: boolean;
    hid?: boolean;
}

export interface Palette {
    length: number;
    rgb: Uint8Array;
    colors: string[];
    abgr: Uint32Array;
    fl: Array<[number, number, number]>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PrevCanvasCoords {}

export interface Chat {
    channels: { [key: string]: Array<number | string> };
    blocked: any[];
    messages: PrevCanvasCoords;
}

export interface ChatRead {
    mute: any[];
    readTs: { [key: string]: number };
    unread: { [key: string]: boolean };
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
