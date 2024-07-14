import { EventEmitter } from 'events';

import { viewPortTouchClientCoordinatesSignal } from '../../gameInjection/viewport';
import { Signal } from 'signal-polyfill';
import { selectPageStateCanvasPalette, selectPageStateCanvasReservedColors, selectPageStateHoverPixel, selectPageStateRoundedCanvasViewCenter } from '../../utils/getPageReduxStore';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';
import { unsafeWindow } from 'vite-plugin-monkey/dist/client';

export interface Cell {
    x: number;
    y: number;
}

/**
 * Filtered out reserved colors from the palette
 */
export const selectCanvasUserPalette = new Signal.Computed(() => {
    const reservedColorCount = selectPageStateCanvasReservedColors.get();
    const palette = selectPageStateCanvasPalette.get();
    return palette.slice(reservedColorCount);
});

let definedSetter = false;
const pixelPlanetEvents = new Signal.State<EventEmitter | undefined>(unsafeWindow.pixelPlanetEvents, {
    [Signal.subtle.watched]: () => {
        if (!unsafeWindow.pixelPlanetEvents) {
            definedSetter = true;
            Object.defineProperty(unsafeWindow, 'pixelPlanetEvents', {
                set: (v) => {
                    definedSetter = false;
                    delete unsafeWindow.pixelPlanetEvents;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- workaround if events not initialized yet
                    unsafeWindow.pixelPlanetEvents = v;
                },
                configurable: true,
            });
            return;
        }

        queueMicrotask(() => {
            if (!pixelPlanetEvents.get()) {
                pixelPlanetEvents.set(unsafeWindow.pixelPlanetEvents);
            }
        });
    },
    [Signal.subtle.unwatched]: () => {
        if (definedSetter) {
            delete unsafeWindow.pixelPlanetEvents;
        }
    },
});

function createViewCenterSignal(events: EventEmitter) {
    const processSetViewCoordinates = (viewCenterArray: unknown) => {
        // console.log('processSetViewCoordinates', viewCenterArray);
        if (!viewCenterArray) return;
        if (!Array.isArray(viewCenterArray)) return;
        if (viewCenterArray.length < 2) return;
        if (typeof viewCenterArray[0] !== 'number' || typeof viewCenterArray[1] !== 'number') return;
        const x = viewCenterArray[0];
        const y = viewCenterArray[1];
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
