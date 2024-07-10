import type { EventEmitter } from 'events';
import { webSocketEvents } from 'gameInjection/webSockets/webSocketEvents';
import React, { useCallback, useEffect, useState } from 'react';
import { chunkDataSlice } from 'store/slices/chunkDataSlice';
import { isOverlayEnabledS, useSignal } from 'store/store';

import { loadSavedConfigurations, startProcessingOutputImage, useReadingInputImageProcess } from '../actions/imageProcessing';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { gameSlice, selectCanvasUserPalette } from '../store/slices/gameSlice';
import { selectInputImageData, selectInputUrl, selectModifierImageBrightness, selectModifierShouldConvertColors, selectModifierSmolPixels } from '../store/slices/overlaySlice';
import {
    selectPageStateCanvasId,
    selectPageStateCanvasMaxTimeoutMs,
    selectPageStateCanvasPalette,
    selectPageStateCanvasReservedColors,
    selectPageStateCanvasSize,
    selectPageStateCanvasTimeoutOnBaseMs,
    selectPageStateCurrentSelectedColor,
    selectPaseStateCanvasTimeoutOnPlacedMs,
    usePageReduxStoreSelector,
} from '../utils/getPageReduxStore';

import ConfigurationModal from './configurationModal/configurationModal';
import OverlayImage from './overlayImage/overlayImage';

declare global {
    interface Window {
        pixelPlanetEvents: EventEmitter;
    }
}

function usePageStoreCurrentSelectedColor() {
    const dispatch = useAppDispatch();
    const currentSelectedColor = usePageReduxStoreSelector(selectPageStateCurrentSelectedColor);
    useEffect(() => {
        if (currentSelectedColor) dispatch(gameSlice.actions.setSelectedColor(currentSelectedColor));
    }, [dispatch, currentSelectedColor]);
}

function usePageStoreCanvasPalette() {
    const dispatch = useAppDispatch();
    const palette = usePageReduxStoreSelector(selectPageStateCanvasPalette);
    useEffect(() => {
        if (palette) dispatch(gameSlice.actions.setPalette(palette));
    }, [dispatch, palette]);
}

function usePageStoreCanvasReservedColors() {
    const dispatch = useAppDispatch();
    const reservedColors = usePageReduxStoreSelector(selectPageStateCanvasReservedColors);
    useEffect(() => {
        if (reservedColors) dispatch(gameSlice.actions.setReservedColorCount(reservedColors ?? 0));
    }, [dispatch, reservedColors]);
}

function usePageStoreCanvasId() {
    const dispatch = useAppDispatch();
    const canvasId = usePageReduxStoreSelector(selectPageStateCanvasId);
    const canvasSize = usePageReduxStoreSelector(selectPageStateCanvasSize);
    const maxTimeoutMs = usePageReduxStoreSelector(selectPageStateCanvasMaxTimeoutMs);
    const timeoutOnBaseMs = usePageReduxStoreSelector(selectPageStateCanvasTimeoutOnBaseMs);
    const timeoutOnPlacedMs = usePageReduxStoreSelector(selectPaseStateCanvasTimeoutOnPlacedMs);

    useEffect(() => {
        if (canvasId) dispatch(gameSlice.actions.setCanvasId(canvasId));
    }, [dispatch, canvasId]);
    useEffect(() => {
        if (canvasSize) dispatch(gameSlice.actions.setCanvasSize(canvasSize));
    }, [dispatch, canvasSize]);
    useEffect(() => {
        if (maxTimeoutMs) dispatch(gameSlice.actions.setMaxTimeoutMs(maxTimeoutMs));
    }, [dispatch, maxTimeoutMs]);
    useEffect(() => {
        if (timeoutOnBaseMs) dispatch(gameSlice.actions.setTimeoutOnBaseMs(timeoutOnBaseMs));
    }, [dispatch, timeoutOnBaseMs]);
    useEffect(() => {
        if (timeoutOnPlacedMs) dispatch(gameSlice.actions.setTimeoutOnPlacedMs(timeoutOnPlacedMs));
    }, [dispatch, timeoutOnPlacedMs]);
}

function useWebSocketEvents() {
    const dispatch = useAppDispatch();
    useEffect(() => webSocketEvents.on('pixelUpdate', (data) => dispatch(chunkDataSlice.actions.setPixel(data))), [dispatch]);
}

function useGlobalKeyShortcuts() {
    const isOverlayEnabled = useSignal(isOverlayEnabledS);
    const handleToggleOverlay = useCallback(() => {
        isOverlayEnabledS[1](!isOverlayEnabled);
    }, [isOverlayEnabled]);
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const { target } = event;
            if (!target) {
                return;
            }

            const clickedNodeName = (target as HTMLElement).tagName || (target as HTMLElement).nodeName;

            // Ignore if user is typing text.
            if (clickedNodeName === 'TEXTAREA') {
                return;
            }
            if (clickedNodeName === 'INPUT') {
                const inputEl = target as HTMLInputElement;
                if (inputEl.type === 'text') {
                    return;
                }
            }

            switch (event.key) {
                case 'o': {
                    event.stopImmediatePropagation();
                    handleToggleOverlay();
                    break;
                }
                default:
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleToggleOverlay]);
}

function useLoadSavedConfigurations() {
    const dispatch = useAppDispatch();
    useEffect(() => {
        dispatch(loadSavedConfigurations());
    }, [dispatch]);
}

function useReprocessOutputImage() {
    const dispatch = useAppDispatch();
    const url = useAppSelector(selectInputUrl);
    const palette = useAppSelector(selectCanvasUserPalette);
    const modifierShouldConvertColors = useAppSelector(selectModifierShouldConvertColors);
    const modifierImageBrightness = useAppSelector(selectModifierImageBrightness);
    const modifierSmolPixels = useAppSelector(selectModifierSmolPixels);
    const inputImageData = useAppSelector(selectInputImageData);
    useEffect(() => {
        dispatch(startProcessingOutputImage());
        // If anything changes, restart processing
    }, [dispatch, url, palette, modifierShouldConvertColors, modifierImageBrightness, modifierSmolPixels, inputImageData]);
}

const ProviderPageStateMapper: React.FC<React.PropsWithChildren> = ({ children }) => {
    useReprocessOutputImage();
    useGlobalKeyShortcuts();
    useLoadSavedConfigurations();
    usePageStoreCurrentSelectedColor();
    usePageStoreCanvasPalette();
    usePageStoreCanvasReservedColors();
    usePageStoreCanvasId();
    useWebSocketEvents();
    useReadingInputImageProcess();
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
};

const App: React.FC = () => {
    const isOverlayEnabled = useSignal(isOverlayEnabledS);

    const [isPageLoaded, setIsPageLoaded] = useState(false);

    // When palette loads consider page loaded.
    // Sometimes userscript might finish loading sooner than page
    const palette = usePageReduxStoreSelector(selectPageStateCanvasPalette);
    useEffect(() => {
        if (!palette?.length) return;
        setIsPageLoaded(true);
    }, [palette]);

    if (!isPageLoaded) return null;

    return (
        <div>
            <ProviderPageStateMapper>
                {isOverlayEnabled && <OverlayImage />}
                <ConfigurationModal />
            </ProviderPageStateMapper>
        </div>
    );
};

export default App;
