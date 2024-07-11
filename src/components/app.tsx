import type { EventEmitter } from 'events';
import { webSocketEvents } from 'gameInjection/webSockets/webSocketEvents';
import React, { useCallback, useEffect, useState } from 'react';
import { chunkDataSlice } from 'store/slices/chunkDataSlice';
import { useSignal } from 'store/useSignal';

import { loadSavedConfigurations, startProcessingOutputImage, useReadingInputImageProcess } from '../actions/imageProcessing';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectCanvasUserPalette } from '../store/slices/gameSlice';
import { isOverlayEnabledS, selectInputImageData, selectInputUrl, selectModifierImageBrightness, selectModifierShouldConvertColors, selectModifierSmolPixels } from '../store/slices/overlaySlice';
import { selectPageStateCanvasPalette } from '../utils/getPageReduxStore';

import ConfigurationModal from './configurationModal/configurationModal';
import OverlayImage from './overlayImage/overlayImage';

declare global {
    interface Window {
        pixelPlanetEvents: EventEmitter;
    }
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
    const palette = useSignal(selectCanvasUserPalette);
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
    const palette = useSignal(selectPageStateCanvasPalette);
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
