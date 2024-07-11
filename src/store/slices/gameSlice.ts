import { EventEmitter } from 'events';

import { viewPortTouchClientCoordinatesSignal } from 'gameInjection/viewport';
import { Signal } from 'signal-polyfill';
import { selectPageStateHoverPixel, selectPageStateRoundedCanvasViewCenter } from 'utils/getPageReduxStore';
import { windowInnerSize } from 'utils/signalPrimitives/windowInnerSize';

import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../store';

export interface Cell {
    x: number;
    y: number;
}

interface GameGuiState {
    viewScale: number;
    viewCenter: Cell;
}

interface CanvasState {
    reservedColorCount: number;
    id: number;
    canvasSize: number;
    selectedColor: number;
    maxTimeoutMs: number;
    timeoutOnBaseMs: number;
    timeoutOnPlacedMs: number;
    latestPixelReturnCooldownMs: number;
}

interface GameState {
    gameGui: GameGuiState;
    canvas: CanvasState;
}

const initialState: GameState = {
    gameGui: {
        viewScale: 1,
        viewCenter: { x: 0, y: 0 },
    },
    canvas: {
        reservedColorCount: 0,
        id: 0,
        canvasSize: 1,
        selectedColor: 0,
        maxTimeoutMs: 100,
        timeoutOnBaseMs: 100,
        timeoutOnPlacedMs: 100,
        latestPixelReturnCooldownMs: 0,
    },
};

export const gameSlice = createSlice({
    initialState,
    name: 'game',
    reducers: {
        setReservedColorCount: (state, action: PayloadAction<number>) => {
            state.canvas.reservedColorCount = action.payload;
        },
        setCanvasId: (state, action: PayloadAction<number>) => {
            state.canvas.id = action.payload;
        },
        setCanvasSize: (state, action: PayloadAction<number>) => {
            state.canvas.canvasSize = action.payload;
        },
        setSelectedColor: (state, action: PayloadAction<number>) => {
            state.canvas.selectedColor = action.payload;
        },
        setMaxTimeoutMs: (state, action: PayloadAction<number>) => {
            state.canvas.maxTimeoutMs = action.payload;
        },
        setTimeoutOnBaseMs: (state, action: PayloadAction<number>) => {
            state.canvas.timeoutOnBaseMs = action.payload;
        },
        setTimeoutOnPlacedMs: (state, action: PayloadAction<number>) => {
            state.canvas.timeoutOnPlacedMs = action.payload;
        },
        setLatestPixelReturnCooldown: (state, action: PayloadAction<number>) => {
            state.canvas.latestPixelReturnCooldownMs = action.payload;
        },
    },
});

export const selectCurrentSelectedColor = createSelector(
    (state: RootState) => state.game.canvas.selectedColor,
    (currentSelectedColor) => currentSelectedColor
);

export const selectCanvasReservedColorCount = createSelector(
    (state: RootState) => state.game.canvas.reservedColorCount,
    (reservedColorCount) => reservedColorCount
);

export const selectCanvasId = createSelector(
    (state: RootState) => state.game.canvas.id,
    (id) => id
);

export const selectCanvasMaxTimeoutMs = createSelector(
    (state: RootState) => state.game.canvas.maxTimeoutMs,
    (maxTimeoutMs) => maxTimeoutMs
);

export const selectCanvasTimeoutOnBaseMs = createSelector(
    (state: RootState) => state.game.canvas.timeoutOnBaseMs,
    (timeoutOnBaseMs) => timeoutOnBaseMs
);

export const selectCanvasTimeoutOnPlacedMs = createSelector(
    (state: RootState) => state.game.canvas.timeoutOnPlacedMs,
    (timeoutOnPlacedMs) => timeoutOnPlacedMs
);

export const selectCanvasLatestPixelReturnCooldownMs = createSelector(
    (state: RootState) => state.game.canvas.latestPixelReturnCooldownMs,
    (latestPixelReturnCooldownMs) => latestPixelReturnCooldownMs
);

/**
 * Filtered out reserved colors from the palette
 */
export const selectCanvasUserPalette = createSelector(selectCanvasReservedColorCount, selectCanvasPalette, (reservedColorCount, palette) => {
    return palette.slice(reservedColorCount);
});

export const selectCanvasSize = createSelector(
    (state: RootState) => state.game.canvas.canvasSize,
    (canvasSize) => canvasSize
);

let definedSetter = false;
const pixelPlanetEvents = new Signal.State<EventEmitter | undefined>(window.pixelPlanetEvents, {
    [Signal.subtle.watched]: () => {
        if (!window.pixelPlanetEvents) {
            definedSetter = true;
            Object.defineProperty(window, 'pixelPlanetEvents', {
                set: (v) => {
                    definedSetter = false;
                    // @ts-expect-error workaround if events not initialized yet
                    delete window.pixelPlanetEvents;
                    window.pixelPlanetEvents = v;
                },
                configurable: true,
            });
            return;
        }

        if (!pixelPlanetEvents.get()) {
            queueMicrotask(() => {
                pixelPlanetEvents.set(window.pixelPlanetEvents);
            });
        }
    },
    [Signal.subtle.unwatched]: () => {
        if (definedSetter) {
            // @ts-expect-error workaround if events not initialized yet
            delete window.pixelPlanetEvents;
        }
    },
});

function createViewCenterSignal(events: EventEmitter) {
    const processSetViewCoordinates = (viewCenterArray: unknown) => {
        if (!viewCenterArray) return;
        if (!Array.isArray(viewCenterArray)) return;
        if (viewCenterArray.length < 2) return;
        const x = viewCenterArray[0];
        const y = viewCenterArray[1];
        if (typeof x !== 'number' || typeof y !== 'number') return;
        viewCenter.set({ x, y });
    };
    const viewCenter = new Signal.State(
        { x: 0, y: 0 },
        {
            [Signal.subtle.watched]: () => events.on('setviewcoordinates', processSetViewCoordinates),
            [Signal.subtle.unwatched]: () => events.off('setviewcoordinates', processSetViewCoordinates),
        }
    );
    return viewCenter;
}

const viewCenterNestedSignal = new Signal.Computed(() => {
    const events = pixelPlanetEvents.get();
    if (!events) return new Signal.State({ x: 0, y: 0 });
    return createViewCenterSignal(events);
});

export const viewCenterSignal = new Signal.Computed(() => {
    const nested = viewCenterNestedSignal.get();
    return nested.get();
});

function createViewScaleSignal(events: EventEmitter) {
    const processSetScale = (scale: unknown) => {
        if (!scale) return;
        if (typeof scale !== 'number') return;
        scaleS.set(scale);
    };
    const scaleS = new Signal.State(1, {
        [Signal.subtle.watched]: () => events.on('setscale', processSetScale),
        [Signal.subtle.unwatched]: () => events.off('setscale', processSetScale),
    });
    return scaleS;
}

const viewScaleNestedSignal = new Signal.Computed(() => {
    const events = pixelPlanetEvents.get();
    if (!events) return new Signal.State(1);
    return createViewScaleSignal(events);
});

export const viewScaleSignal = new Signal.Computed(() => {
    const nested = viewScaleNestedSignal.get();
    return nested.get();
});

const touchHoverPixelSignal = new Signal.Computed(() => {
    const { clientX, clientY, timestamp } = viewPortTouchClientCoordinatesSignal.get();
    const { height, width } = windowInnerSize.get();
    const viewScale = viewScaleSignal.get();
    const viewCenter = viewCenterSignal.get();
    const x = Math.floor((clientX - width / 2) / viewScale + viewCenter.x);
    const y = Math.floor((clientY - height / 2) / viewScale + viewCenter.y);
    return { x, y, timestamp };
});

export const hoverPixelSignal = new Signal.Computed(() => {
    const touchPixel = touchHoverPixelSignal.get();
    const pageHover = latestPageHoverPixelState.get();
    const view = latestRoundedViewCenter.get();
    const latest = [touchPixel, pageHover, view].sort((a, b) => (b?.timestamp ?? 0) - (a?.timestamp ?? 0))[0];
    if (!latest) return { x: 0, y: 0 };
    return { x: latest.x, y: latest.y };
});

const latestPageHoverPixelState = new Signal.Computed(() => {
    const p = selectPageStateHoverPixel.get();
    if (!p) return undefined;
    return { ...p, timestamp: Date.now() };
});

const latestRoundedViewCenter = new Signal.Computed(() => {
    const view = selectPageStateRoundedCanvasViewCenter.get();
    if (!view) return undefined;
    return { ...view, timestamp: Date.now() };
});
