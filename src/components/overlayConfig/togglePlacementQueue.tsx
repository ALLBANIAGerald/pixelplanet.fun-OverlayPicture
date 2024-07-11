import { PixelUpdateReturnCode } from '../../gameInjection/webSockets/packets/pixelReturn';
import { latestPixelReturnCooldownMsSignal, placePixel } from '../../gameInjection/webSockets/webSocketPixelPlace';
import logger from '../../handlers/logger';
import { useAsyncInterval } from '../../hooks/useInterval';
import React, { useCallback } from 'react';
import { pixelPlacementSlice, selectPixelPlaceQueueEnabled, selectPixelsToPlaceQueueFirstPixel } from '../../store/slices/pixelPlacementSlice';
import { store } from '../../store/store';
import { useSignal } from '../../store/useSignal';
import { gameCoordsToChunk } from '../../utils/coordConversion';
import {
    selectPageStateCanvasMaxTimeoutMs,
    selectPageStateCanvasSize,
    selectPageStateCanvasTimeoutOnBaseMs,
    selectPageStatePixelWaitDate,
    selectPaseStateCanvasTimeoutOnPlacedMs,
} from '../../utils/getPageReduxStore';

import { Checkbox, FormControlLabel } from '@mui/material';

import { useAppDispatch, useAppSelector } from '../../store/hooks';

const TogglePlacementQueue: React.FC = () => {
    const isEnabled = useAppSelector(selectPixelPlaceQueueEnabled);
    const areAnyPixelsInQueue = useAppSelector(selectPixelsToPlaceQueueFirstPixel) !== undefined;
    const dispatch = useAppDispatch();
    // different events version, intercept actual click and add pixel then
    // const mouseDownEventCallback = useCallback(() => {
    //     const hoverPixel = selectHoverPixel(store.getState());
    //     const selectedColor = selectCurrentSelectedColor(store.getState());
    //     dispatch(pixelPlacementSlice.actions.addPixelsToPlaceQueue([{ coord: hoverPixel, color: selectedColor }]));
    // }, [dispatch]);
    // useEffect(() => {
    //     if (isEnabled) {
    //         return viewPortEvents.on('mouseDownCaptured', (ev) => {
    //             ev.stopPropagation();
    //             mouseDownEventCallback();
    //         });
    //     }
    //     return undefined;
    // }, [isEnabled, mouseDownEventCallback]);

    const canvasSize = useSignal(selectPageStateCanvasSize);

    const waitDate = useSignal(selectPageStatePixelWaitDate);
    const waitUntilMs = waitDate?.getTime() ?? Date.now();
    const maxTimeoutMs = useSignal(selectPageStateCanvasMaxTimeoutMs);
    const timeoutOnBaseMs = useSignal(selectPageStateCanvasTimeoutOnBaseMs);
    const timeoutOnPlacedMs = useSignal(selectPaseStateCanvasTimeoutOnPlacedMs);
    const latestPixelReturnCooldownMs = useSignal(latestPixelReturnCooldownMsSignal);
    const maxSinglePixelTimeoutMs = Math.max(timeoutOnBaseMs, timeoutOnPlacedMs, latestPixelReturnCooldownMs);
    const nowMs = Date.now();
    const untilPlacementAttemptMs = Math.max(waitUntilMs - nowMs - (maxTimeoutMs - maxSinglePixelTimeoutMs), 200);
    useAsyncInterval(
        async () => {
            const pixelToPlace = selectPixelsToPlaceQueueFirstPixel(store.getState());
            if (!pixelToPlace) return;
            const { coord, color } = pixelToPlace;
            const { chunkX, chunkY, offsetInChunk } = gameCoordsToChunk(coord, canvasSize);
            const returnedPixels = await placePixel(chunkX, chunkY, [{ color, offsetInChunk }]);

            switch (returnedPixels.retCode) {
                case PixelUpdateReturnCode.success:
                case PixelUpdateReturnCode.protectedPixel:
                case PixelUpdateReturnCode.xOutOfBounds:
                case PixelUpdateReturnCode.yOutOfBounds:
                case PixelUpdateReturnCode.zOutOfBounds:
                case PixelUpdateReturnCode.colorOutOfBounds:
                    dispatch(pixelPlacementSlice.actions.removePixelsFromPlaceQueue({ canvasSize, pixels: [pixelToPlace] }));
                    break;
                case PixelUpdateReturnCode.catchaNeeded:
                case PixelUpdateReturnCode.canvasDoesntExist:
                case PixelUpdateReturnCode.notLoggedIn:
                case PixelUpdateReturnCode.notEnoughPixelsPlaced:
                case PixelUpdateReturnCode.needToBeInTop10:
                case PixelUpdateReturnCode.proxyDetected:
                    dispatch(pixelPlacementSlice.actions.setPixelPlaceQueueEnabled(false));
                    break;
                case PixelUpdateReturnCode.cooldownLimitReached:
                    break;
                default:
                    logger.logError('unknown pixel return code', returnedPixels.retCode);
                    dispatch(pixelPlacementSlice.actions.setPixelPlaceQueueEnabled(false));
                    break;
            }
        },
        isEnabled && areAnyPixelsInQueue ? untilPlacementAttemptMs : null
    );

    const handleToggle = useCallback(() => {
        dispatch(pixelPlacementSlice.actions.setPixelPlaceQueueEnabled(!isEnabled));
    }, [dispatch, isEnabled]);

    return <FormControlLabel control={<Checkbox color="primary" checked={isEnabled} onChange={handleToggle} />} label="Place Queue" labelPlacement="end" />;
};

export default TogglePlacementQueue;
