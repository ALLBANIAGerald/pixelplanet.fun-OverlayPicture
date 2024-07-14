import colorConverter from '../../colorConverter';
import logger from '../../handlers/logger';
import localforage from 'localforage';
import { Signal } from 'signal-polyfill';
import { getStoredValue } from '../../store/getStoredData';
import { selectPageStateCanvasId, selectPageStateCanvasPalette, selectPageStateCanvasReservedColors } from '../../utils/getPageReduxStore';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';

import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { RootState } from '../store';

import { hoverPixelSignal, viewCenterSignal, viewScaleSignal } from './gameSlice';
import { gameCoordsToScreen, screenToGameCoords } from '../../utils/coordConversion';

interface OverlayImageInputState {
    url?: string;
    file?: File;
}

interface OverlayImageState {
    inputImage: OverlayImageInputState;
}

interface PlacementConfigurationState {
    xOffset: number;
    yOffset: number;
    transparency: number;
    isFollowMouseActive: boolean;
    autoSelectColor: boolean;
}

interface ImageModifiersState {
    shouldConvertColors: boolean;
    imageBrightness: number;
    smolPixels: boolean;
}

export interface OverlaySavedConfigurationState {
    imageUrl: string;
    modifiers: { shouldConvertColors: boolean; autoSelectColor: boolean; imageBrightness: number };
    placementConfiguration: { xOffset: number; yOffset: number; transparency: number };
}

interface BrowserWindowState {
    innerWidth: number;
    innerHeight: number;
}

interface OverlayState {
    savedConfigs: OverlaySavedConfigurationState[];
    overlayEnabled: boolean;
    overlayImage: OverlayImageState;
    placementConfiguration: PlacementConfigurationState;
    modifications: ImageModifiersState;
    browserWindow: BrowserWindowState;
}

const initialState: OverlayState = {
    savedConfigs: [],
    overlayEnabled: true,
    overlayImage: { inputImage: {} },
    placementConfiguration: { yOffset: 0, xOffset: 0, transparency: 92, isFollowMouseActive: false, autoSelectColor: false },
    modifications: { imageBrightness: 0, shouldConvertColors: false, smolPixels: false },
    browserWindow: { innerWidth: 100, innerHeight: 100 },
};

export const overlaySlice = createSlice({
    initialState,
    name: 'overlay',
    reducers: {
        setPlacementXOffset: (state, action: PayloadAction<number>) => {
            state.placementConfiguration.xOffset = action.payload;
        },
        setPlacementYOffset: (state, action: PayloadAction<number>) => {
            state.placementConfiguration.yOffset = action.payload;
        },
        setPlacementTransparency: (state, action: PayloadAction<number>) => {
            state.placementConfiguration.transparency = action.payload;
        },
        togglePlacementFollowMouse: (state) => {
            state.placementConfiguration.isFollowMouseActive = !state.placementConfiguration.isFollowMouseActive;
        },
        setPlacementIsFollowMouseActive: (state, action: PayloadAction<boolean>) => {
            state.placementConfiguration.isFollowMouseActive = action.payload;
        },
        setPlacementAutoSelectColor: (state, action: PayloadAction<boolean>) => {
            state.placementConfiguration.autoSelectColor = action.payload;
        },
        setModifierImageBrightness: (state, action: PayloadAction<number>) => {
            state.modifications.imageBrightness = action.payload;
        },
        setModifierShouldConvertColors: (state, action: PayloadAction<boolean>) => {
            state.modifications.shouldConvertColors = action.payload;
        },
        setModifierSmolPixels: (state, action: PayloadAction<boolean>) => {
            state.modifications.smolPixels = action.payload;
        },
        saveConfiguration: (state, action: PayloadAction<OverlaySavedConfigurationState>) => {
            const savedConfigurations = state.savedConfigs;
            const existingConfiguration = savedConfigurations.find((c) => c.imageUrl === action.payload.imageUrl);
            if (existingConfiguration != null) {
                existingConfiguration.modifiers = action.payload.modifiers;
                existingConfiguration.placementConfiguration = action.payload.placementConfiguration;
            } else {
                savedConfigurations.push(action.payload);
            }
        },
        removeSavedConfig: (state, action: PayloadAction<string>) => {
            const savedConfigurations = state.savedConfigs;
            const existingConfiguration = savedConfigurations.find((c) => c.imageUrl === action.payload);
            if (existingConfiguration) {
                savedConfigurations.splice(savedConfigurations.indexOf(existingConfiguration), 1);
            }
        },
    },
});

export const selectInputUrl = createSelector(
    (state: RootState) => state.overlay.overlayImage.inputImage.url,
    (url) => url
);

export const selectInputImageData = createSelector(
    (state: RootState) => state.processedImages.inputImage.loadedImage.imageData,
    (imageData) => imageData
);

export const selectIsModificationsAvailable = createSelector(selectInputImageData, (inputImageData) => {
    return !!inputImageData;
});

export const selectInputFile = createSelector(
    (state: RootState) => state.overlay.overlayImage.inputImage.file,
    (file) => file
);

export const selectFileName = createSelector(selectInputFile, selectInputUrl, (file, url) => {
    const fileName = file?.name ?? url?.split('/').pop();
    if (fileName) {
        return {
            fileName,
            fileExtension: fileName.split('.').pop(),
            fileNameWithoutExtension: fileName.split('.').slice(0, -1).join('.'),
        };
    }
    return undefined;
});

export const selectShouldShowPlacementConfiguration = createSelector(selectInputFile, selectInputUrl, (file, url) => file || url);

export const selectPlacementXOffset = createSelector(
    (state: RootState) => state.overlay.placementConfiguration.xOffset,
    (xOffset) => xOffset
);

export const selectPlacementYOffset = createSelector(
    (state: RootState) => state.overlay.placementConfiguration.yOffset,
    (yOffset) => yOffset
);

export const selectPlacementTransparency = createSelector(
    (state: RootState) => state.overlay.placementConfiguration.transparency,
    (transparency) => transparency
);

export const selectPlacementIsFollowMouseActive = createSelector(
    (state: RootState) => state.overlay.placementConfiguration.isFollowMouseActive,
    (isFollowMouseActive) => isFollowMouseActive
);

export const selectPlacementAutoSelectColor = createSelector(
    (state: RootState) => state.overlay.placementConfiguration.autoSelectColor,
    (autoSelectColor) => autoSelectColor
);

export const selectModifierImageBrightness = createSelector(
    (state: RootState) => state.overlay.modifications.imageBrightness,
    (imageBrightness) => imageBrightness
);

export const selectModifierSmolPixels = createSelector(
    (state: RootState) => state.overlay.modifications.smolPixels,
    (smolPixels) => smolPixels
);

export const selectInputImageLoadingStatus = createSelector(
    (state: RootState) => state.processedImages.inputImage.loadedImage.status,
    (status) => status
);

export const selectIsOutputImageProcessing = createSelector(
    (state: RootState) => state.processedImages.outputImage.isProcessing,
    (isProcessing) => isProcessing
);

const selectOutputImageData = createSelector(
    (state: RootState) => state.processedImages.outputImage.isProcessing,
    (state: RootState) => state.processedImages.outputImage.imageData,
    (state: RootState) => state.processedImages.outputImage.abortController,
    (isProcessing, imageData, abortController) => {
        if (!isProcessing && imageData) {
            return imageData;
        }
        return undefined;
    }
);

export const selectRenderImageData = createSelector(selectOutputImageData, selectInputImageData, (outputImageData, inputImageData) => {
    return outputImageData || inputImageData;
});

export const selectShouldShowImageFromData = createSelector(selectRenderImageData, (imageData) => !!imageData);

export const selectShouldShowImageFromUrl = createSelector(selectShouldShowImageFromData, selectInputFile, selectInputUrl, (shouldShowImageFromData, file, url) => {
    if (shouldShowImageFromData) return false;
    if (file || url) return true;
    return false;
});

export const selectOverlayImageDataOrUrl = createSelector(selectInputUrl, selectOutputImageData, (url, imageData) => {
    return imageData || url;
});

// leftOffset: window.innerWidth / 2 - (gameState.centerX - placementConfiguration.xOffset) * gameStore.gameState.viewScale,
// topOffset: window.innerHeight / 2 - (gameState.centerY - placementConfiguration.yOffset) * gameStore.gameState.viewScale,
export const selectOverlayOffsetCoordsOnScreen = createSelector(selectPlacementXOffset, selectPlacementYOffset, (xOffset, yOffset) => {
    const windowSize = windowInnerSize.get();
    const gameViewCenter = viewCenterSignal.get();
    const viewScale = viewScaleSignal.get();
    const leftOffset = windowSize.width / 2 - (gameViewCenter.x - xOffset) * viewScale;
    const topOffset = windowSize.height / 2 - (gameViewCenter.y - yOffset) * viewScale;
    return { leftOffset, topOffset };
});

export const selectCurrentHoverPixelOnOutputImageColorIndexInPalette = createSelector(
    selectPlacementAutoSelectColor,
    selectModifierSmolPixels,
    selectPlacementXOffset,
    selectPlacementYOffset,
    selectRenderImageData,
    (autoSelectColor, modifierSmolPixels, placementXOffset, placementYOffset, renderImageData) => {
        if (!autoSelectColor) return undefined;
        if (!renderImageData) return undefined;
        const hoverPixel = hoverPixelSignal.get();
        const palette = selectPageStateCanvasPalette.get();
        const reservedColorCount = selectPageStateCanvasReservedColors.get();
        const smolPixelsCanvasSizeModifier = modifierSmolPixels ? 3 : 1;
        const smolPixelsCanvasExtraOffsetToMiddle = Math.floor(smolPixelsCanvasSizeModifier / 2);
        const offsetXInImage = (hoverPixel.x - placementXOffset) * smolPixelsCanvasSizeModifier + smolPixelsCanvasExtraOffsetToMiddle;
        const offsetYInImage = (hoverPixel.y - placementYOffset) * smolPixelsCanvasSizeModifier + smolPixelsCanvasExtraOffsetToMiddle;
        if (offsetXInImage < 0 || offsetXInImage >= renderImageData.width || offsetYInImage < 0 || offsetYInImage >= renderImageData.height) return undefined;
        // eslint-disable-next-line no-bitwise
        const idx = (renderImageData.width * offsetYInImage + offsetXInImage) << 2;
        const r = renderImageData.data[idx + 0];
        const g = renderImageData.data[idx + 1];
        const b = renderImageData.data[idx + 2];
        const a = renderImageData.data[idx + 3];
        if (r == null || g == null || b == null || a == null) return undefined;
        if (a < 30) return undefined;
        const colorIndex = colorConverter.convertActualColorFromPalette(palette, reservedColorCount, r, g, b);
        return colorIndex;
    }
);

export const selectSavedConfigurations = createSelector(
    (state: RootState) => state.overlay.savedConfigs,
    (savedConfigurations) => savedConfigurations
);

export const selectCurrentStateAsConfiguration = createSelector(
    selectInputUrl,
    selectPlacementXOffset,
    selectPlacementYOffset,
    selectPlacementTransparency,
    selectPlacementAutoSelectColor,
    selectModifierImageBrightness,
    (inputUrl, xOffset, yOffset, transparency, autoSelectColor, imageBrightness): OverlaySavedConfigurationState | undefined => {
        if (!inputUrl) return undefined;
        return {
            imageUrl: inputUrl,
            modifiers: {
                autoSelectColor,
                imageBrightness,
                shouldConvertColors: true, //shouldConvertColors,
            },
            placementConfiguration: {
                xOffset,
                yOffset,
                transparency,
            },
        };
    }
);

export interface OverlayImage {
    id: number;
    enabled: boolean;
    title: string;
    canvasId: string;
    location: {
        x: number;
        y: number;
    };
    size: {
        width: number;
        height: number;
    };
    // transparency: number; --- global transparency?
    modifications: {
        convertColors: {
            enabled: boolean;
        };
        overrideBrightness: {
            brightness: number;
        };
    };
    imageFile:
        | {
              type: 'file';
              file: File;
          }
        | {
              type: 'url';
              url: string;
          };
    // resize: {
    //     width: number;
    //     height: number;
    // };
}

// store OverlayImage[] in indexedDb.
// TODO migrate old saved data, make everything but current "disabled"
// OverlayImage should store every detail required to display an image, multiple are available at a time
// TODO do not display image if it's outside of screen
// TODO small Pixels should only be visible from some specific zoom scale and bigger.
// TODO display list of saved images, when selected, export button.
// TODO edit button will mark current one as "current", it's details will be loaded into current edit modal, and changes will be applied to that image

const signalsStorage = localforage.createInstance({ name: 'picture_overlay', storeName: 'signals' });
export const isOverlayEnabledSignal = persistedSignal(true, 'isOverlayEnabled', (o) => o.overlayEnabled);
export const overlayImagesSignal = persistedSignal<OverlayImage[]>([], 'overlayImages', (o) => {
    const saved = o.savedConfigs.map<OverlayImage>((x, index) => ({
        canvasId: '0',
        enabled: false,
        id: index,
        imageFile: {
            type: 'url',
            url: x.imageUrl,
        },
        modifications: {
            convertColors: { enabled: x.modifiers.shouldConvertColors },
            overrideBrightness: { brightness: x.modifiers.imageBrightness },
        },
        title: 'Migrated',
        location: {
            x: x.placementConfiguration.xOffset,
            y: x.placementConfiguration.yOffset,
        },
        size: {
            // Some arbitrary value, big enough for most cases
            height: 1024,
            width: 1024,
        },
    }));
    let img: OverlayImage['imageFile'] | undefined = o.overlayImage.inputImage.file
        ? {
              type: 'file',
              file: o.overlayImage.inputImage.file,
          }
        : undefined;
    if (img === undefined)
        img = o.overlayImage.inputImage.url
            ? {
                  type: 'url',
                  url: o.overlayImage.inputImage.url,
              }
            : undefined;
    if (img)
        saved.push({
            canvasId: '0',
            enabled: true,
            id: saved.length,
            imageFile: img,
            modifications: {
                convertColors: { enabled: o.modifications.shouldConvertColors },
                overrideBrightness: { brightness: o.modifications.imageBrightness },
            },
            title: o.overlayImage.inputImage.file?.name ?? 'Migrated',
            location: {
                x: o.placementConfiguration.xOffset,
                y: o.placementConfiguration.yOffset,
            },
            size: {
                height: 1024,
                width: 1024,
            },
        });
    return saved;
});
export const overlayTransparencySignal = new Signal.State(90);
export const isFollowMouseActiveSignal = new Signal.State(false);
export const isAutoSelectColorActiveSignal = new Signal.State(false);
export const isShowSmallPixelsActiveSignal = new Signal.State(true);

export type StoredSignal<T> = [() => T, (newValue: T) => void];

function persistedSignal<T = unknown>(initialValue: T, key: string, mapOld?: (old: RootState['overlay']) => T | Promise<T>): StoredSignal<T> {
    const signal = new Signal.State(initialValue);
    let initialized = false;
    signalsStorage
        .getItem<T>(key)
        .then(async (stored) => {
            if (stored === null && mapOld) return getStoredValue(mapOld);
            return stored;
        })
        .then((stored) => {
            if (stored == null) return;
            if (!initialized) signal.set(stored);
        })
        .catch((e: unknown) => {
            logger.log('failed to get persisted signal value', signal, e);
        })
        .finally(() => {
            initialized = true;
        });

    return [
        () => signal.get(),
        (newValue: T) => {
            if (initialized) void signalsStorage.setItem(key, newValue);
            signal.set(newValue);
        },
    ];
}

export const overlayImagesById = new Signal.Computed(() => {
    const images = overlayImagesSignal[0]();
    return images.reduce<Record<string, OverlayImage>>((acc, curr) => {
        acc[curr.id] = curr;
        return acc;
    }, {});
});
// TODO create new signal with overlayImagesLocations
// Should contain {canvasId: string, id: number, x:number, y: number, width: number, height: number}[]
// And have custom equality comparison. go through the array and check if anything changed
export const enabledOverlayImages = new Signal.Computed(() => overlayImagesSignal[0]().filter((x) => x.enabled));
export const imagesOnCurrentCanvas = new Signal.Computed(() => {
    const currentCanvasId = selectPageStateCanvasId.get();
    const images = overlayImagesSignal[0]();
    const imagesOnCanvas = images.filter((x) => x.canvasId === currentCanvasId);
    return imagesOnCanvas;
});
export const visibleOnScreenOverlayImages = new Signal.Computed(() => {
    const windowSize = windowInnerSize.get();
    const viewCenter = viewCenterSignal.get();
    const viewScale = viewScaleSignal.get();
    return imagesOnCurrentCanvas.get().filter((x) => {
        const screenCoordsTopLeft = gameCoordsToScreen({ x: x.location.x, y: x.location.y }, windowSize, viewCenter, viewScale);
        const screenCoordsBottomRight = gameCoordsToScreen({ x: x.location.x + x.size.width, y: x.location.y + x.size.height }, windowSize, viewCenter, viewScale);
        if (screenCoordsBottomRight.clientX < 0 || screenCoordsBottomRight.clientY < 0) return false;
        if (screenCoordsTopLeft.clientX > windowSize.width || screenCoordsTopLeft.clientY > windowSize.height) return false;
        return true;
    });
});
export const topLeftScreenToGameCoordinates = new Signal.Computed(() => {
    const windowSize = windowInnerSize.get();
    const viewCenter = viewCenterSignal.get();
    const viewScale = viewScaleSignal.get();
    return screenToGameCoords({ clientX: 0, clientY: 0 }, windowSize, viewCenter, viewScale);
});
