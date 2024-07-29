import logger from '../../handlers/logger';
import localforage from 'localforage';
import { Signal } from 'signal-polyfill';
import { getStoredValue } from '../../store/getStoredData';
import { selectPageStateCanvasId, templateByIdObs, templatesIdsObs } from '../../utils/getPageReduxStore';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';

import { templateLoaderReadyObs, viewCenterSignal, viewScaleSignal } from './gameSlice';
import { gameCoordsToScreen, screenToGameCoords } from '../../utils/coordConversion';
import { createSignalComputed, createSignalState } from '../../utils/signalPrimitives/createSignal';
import { produce } from 'immer';
import { combineLatestWith, filter, from, map, switchMap, take } from 'rxjs';
import { pictureConverterApi } from '../../pictureConversionApi';
import { signalToObs } from '../obsToSignal';

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

export type StoredSignal<T> = [() => T, (newValue: T) => void];

function persistedSignal<T = unknown>(initialValue: T, key: string, mapOld?: (old: OverlayState) => T | Promise<T>): StoredSignal<T> {
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

export const overlayImagesById = createSignalComputed(() => {
    const images = overlayImagesSignal[0]();
    return images.reduce<Record<number, OverlayImage>>((acc, curr) => {
        acc[curr.id] = curr;
        return acc;
    }, {});
});

export const overlayImagesIds = createSignalComputed(
    () => {
        const imagesIds = overlayImagesSignal[0]().map((x) => x.id);
        return new Set(imagesIds);
    },
    undefined,
    (a, b) => a.symmetricDifference(b).size === 0
);

export const overlayImagesIdsOnCurrentCanvas = createSignalComputed(
    () => {
        const currentCanvasId = selectPageStateCanvasId.get();
        const images = overlayImagesSignal[0]();
        const imagesOnCanvas = images.filter((x) => x.canvasId === currentCanvasId);
        return new Set(imagesOnCanvas.map((x) => x.id));
    },
    undefined,
    (a, b) => a.symmetricDifference(b).size === 0
);

export const overlayImagesIdsVisibleOnScreen = createSignalComputed(
    () => {
        const windowSize = windowInnerSize.get();
        const viewCenter = viewCenterSignal.get();
        const viewScale = viewScaleSignal.get();
        const imagesById = overlayImagesById.get();
        const idsSet = overlayImagesIdsOnCurrentCanvas.get();
        return new Set(
            [...idsSet].filter((id) => {
                const x = imagesById[id];
                if (!x) return false;
                if (!x.enabled) return false;
                const screenCoordsTopLeft = gameCoordsToScreen({ x: x.location.x, y: x.location.y }, windowSize, viewCenter, viewScale);
                const screenCoordsBottomRight = gameCoordsToScreen({ x: x.location.x + x.size.width, y: x.location.y + x.size.height }, windowSize, viewCenter, viewScale);
                if (screenCoordsBottomRight.clientX < 0 || screenCoordsBottomRight.clientY < 0) return false;
                if (screenCoordsTopLeft.clientX > windowSize.width || screenCoordsTopLeft.clientY > windowSize.height) return false;
                return true;
            })
        );
    },
    undefined,
    (a, b) => a.symmetricDifference(b).size === 0
);

export const topLeftScreenToGameCoordinates = new Signal.Computed(() => {
    const windowSize = windowInnerSize.get();
    const viewCenter = viewCenterSignal.get();
    const viewScale = viewScaleSignal.get();
    return screenToGameCoords({ clientX: 0, clientY: 0 }, windowSize, viewCenter, viewScale);
});

export const overlayImagesIdsSortedDistanceToViewCenter = createSignalComputed(
    () => {
        const images = [...overlayImagesIdsOnCurrentCanvas.get()]
            .map((x) => overlayImagesById.get()[x])
            .filter((x) => !!x)
            .filter((x) => x.enabled);
        return images
            .map((image) => ({ distanceSq: (image.location.x - viewCenterSignal.get().x) ** 2 + (image.location.y - viewCenterSignal.get().y) ** 2, imageId: image.id }))
            .toSorted((a, b) => a.distanceSq - b.distanceSq)
            .map((x) => x.imageId);
    },
    undefined,
    (a, b) => {
        if (a.length !== b.length) return false;
        for (let index = 0; index < a.length; index++) {
            if (a[index] !== b[index]) return false;
        }
        return true;
    }
);

export const showBigModal = createSignalState(true);

export const dragModeEnabled = createSignalState(false);

export const templateModificationMapping = persistedSignal(new Map<number, number>(), 'templateModificationMapping');
export const templateModificationSettings = persistedSignal(new Map<number, { convertColors: boolean; imageBrightness: number }>(), 'templateModificationSettings');

const templateModificationSettingsObs = signalToObs(templateModificationSettings);
function getTemplateModificationObs(id: number) {
    return templatesIdsObs.pipe(
        filter((x) => x.has(id)),
        switchMap(() => templateByIdObs.pipe(map((templateById) => templateById.get(id)))),
        filter((x) => x !== undefined),
        combineLatestWith(templateLoaderReadyObs),
        switchMap(([template, templateLoader]) => from(templateLoader.getTemplate(id)).pipe(map((canvas) => [template, canvas] as const))),
        filter(([, canvas]) => canvas != null),
        map(([template, canvas]) => canvas?.getContext('2d')?.getImageData(0, 0, template.width, template.height, { colorSpace: 'srgb' })),
        combineLatestWith(templateModificationSettingsObs),
        map((x) => [x[0], x[1].get(id)] as const),
        switchMap((x) => from(pictureConverterApi.applyModificationsToImageData()))
    );
}
