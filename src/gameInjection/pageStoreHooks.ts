import logger from 'handlers/logger';
import { selectCurrentHoverPixelOnOutputImageColorIndexInPalette } from 'store/slices/overlaySlice';
import { store } from 'store/store';
import { findPageReduxStore, pageReduxStoreSelectColorAction } from 'utils/getPageReduxStore';

export function executeAllHooks(retryCounter = 0) {
    try {
        hookForAutoSelectColor();
    } catch (error) {
        if (retryCounter > 5) {
            // Something is terribly wrong.
            logger.logError('failed to executeAllHooks multiple times. Rethrowing exception', error);
            throw error;
        }
        const retryInMs = (retryCounter + 1) * 1000;
        logger.log('failed to executeAllHooks', error, 'retrying in', retryInMs);
        setTimeout(() => {
            executeAllHooks(retryCounter + 1);
        }, retryInMs);
    }
}

function hookForAutoSelectColor() {
    const pageStore = findPageReduxStore();
    const pageDispatch = pageStore.dispatch;
    let lastColorIndex: number;
    store.subscribe(() => {
        const colorIndex = selectCurrentHoverPixelOnOutputImageColorIndexInPalette(store.getState());
        if (colorIndex !== undefined && colorIndex !== lastColorIndex) {
            lastColorIndex = colorIndex;
            pageDispatch(pageReduxStoreSelectColorAction(colorIndex));
        }
    });
}
