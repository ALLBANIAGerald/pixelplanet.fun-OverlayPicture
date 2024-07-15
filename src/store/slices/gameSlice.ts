import { EventEmitter } from 'events';

import { viewPortTouchClientCoordinatesSignal } from '../../gameInjection/viewport';
import { Signal } from 'signal-polyfill';
import { selectPageStateCanvasPalette, selectPageStateCanvasReservedColors, selectPageStateHoverPixel, selectPageStateRoundedCanvasViewCenter } from '../../utils/getPageReduxStore';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';
import { unsafeWindow } from 'vite-plugin-monkey/dist/client';
import { createSignalComputed, createSignalState } from '../../utils/signalPrimitives/createSignal';
import { createSignalComputedNested } from '../../utils/signalPrimitives/createSignalComputedNested';

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

export const viewCenterSignal = createSignalComputedNested(() => {
    const events = pixelPlanetEvents.get();
    if (!events) return new Signal.State({ x: 0, y: 0 });
    return createSignalState(
        { x: 0, y: 0 },
        (s) => {
            const processSetViewCoordinates = (viewCenterArray: unknown) => {
                // console.log('processSetViewCoordinates', viewCenterArray);
                if (!viewCenterArray) return;
                if (!Array.isArray(viewCenterArray)) return;
                if (viewCenterArray.length < 2) return;
                if (typeof viewCenterArray[0] !== 'number' || typeof viewCenterArray[1] !== 'number') return;
                const x = viewCenterArray[0];
                const y = viewCenterArray[1];
                s.set({ x, y });
            };
            events.on('setviewcoordinates', processSetViewCoordinates);
            return () => events.off('setviewcoordinates', processSetViewCoordinates);
        },
        (a, b) => a.x === b.x && a.y === b.y
    );
});

export const viewScaleSignal = createSignalComputedNested(() => {
    const events = pixelPlanetEvents.get();
    if (!events) return new Signal.State(1);
    return createSignalState(1, (s) => {
        const processSetScale = (scale: unknown) => {
            if (!scale) return;
            if (typeof scale !== 'number') return;
            s.set(scale);
        };
        events.on('setscale', processSetScale);
        return () => events.off('setscale', processSetScale);
    });
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

export const hoverPixelSignal = createSignalComputed(() => {
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
