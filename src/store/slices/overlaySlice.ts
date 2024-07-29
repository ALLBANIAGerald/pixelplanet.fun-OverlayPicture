import logger from '../../handlers/logger';
import localforage from 'localforage';
import { Signal } from 'signal-polyfill';
import { getStoredValue } from '../../store/getStoredData';
import { stateCanvasPaletteObs, selectPageStateCanvasId, templateByIdObs, templatesIdsObs } from '../../utils/getPageReduxStore';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';

import { templateLoaderReadyObs, templatesIdsInViewObs, viewCenterSignal, viewScaleSignal } from './gameSlice';
import { gameCoordsToScreen, screenToGameCoords } from '../../utils/coordConversion';
import { createSignalComputed, createSignalState } from '../../utils/signalPrimitives/createSignal';
import { combineLatestWith, concatMap, distinctUntilChanged, filter, forkJoin, from, lastValueFrom, map, mergeMap, ObservedValueOf, of, Subject, switchMap, tap } from 'rxjs';
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

function getTemplateImageDataWithModificationsApplied$(id: number) {
    return templatesIdsObs.pipe(
        filter((x) => x.has(id)),
        switchMap(() =>
            templateModificationSettingsObs.pipe(
                map((x) => x.get(id)),
                filter((x) => x !== undefined),
                filter((x) => x.convertColors)
            )
        ),
        combineLatestWith(getTemplateImageData$(id), stateCanvasPaletteObs),
        switchMap(([modificationSettings, imageData, palette]) => from(pictureConverterApi.applyModificationsToImageData(palette, imageData, modificationSettings.imageBrightness)))
    );
}

function getTemplateById$(id: number) {
    return templateByIdObs.pipe(
        map((templateById) => templateById.get(id)),
        filter((x) => x !== undefined),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    );
}

function getTemplateCanvas$(id: number) {
    return templateLoaderReadyObs.pipe(
        switchMap((templateLoader) => from(templateLoader.getTemplate(id))),
        filter((x) => x !== null)
    );
}

function getTemplateByTitle$(title: string) {
    return templateByIdObs.pipe(
        map((x) => Array.from(x.values()).find((x) => x.title === title)),
        filter((x) => x !== undefined),
        distinctUntilChanged()
    );
}

function getTemplateImageData$(id: number) {
    return getTemplateById$(id).pipe(
        combineLatestWith(getTemplateCanvas$(id)),
        map(([template, canvas]) => canvas.getContext('2d')?.getImageData(0, 0, template.width, template.height, { colorSpace: 'srgb' })),
        filter((x) => x !== undefined)
    );
}

const templateModificationMapping$ = signalToObs(templateModificationMapping).pipe();

function canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }
            reject(new Error('blob is null'));
        });
    });
}

const templatesAndModifiedIds$ = templateByIdObs.pipe(
    map((x) => Array.from(x.values())),
    map((template) =>
        template.map((x) => {
            const matches = x.title.match(/-modified-imageoverlay-(\d+)$/);
            if (!matches || matches[1] === undefined) return { id: x.imageId };
            return { id: x.imageId, originalId: parseInt(matches[1]) };
        })
    )
);

const modifiedTemplates$ = templatesAndModifiedIds$.pipe(
    map((ids) => ids.filter((x) => x.originalId !== undefined)),
    distinctUntilChanged((prev, curr) => new Set(prev).symmetricDifference(new Set(curr)).size === 0)
);
const visibleModifiedTemplateIds$ = templatesIdsInViewObs.pipe(
    combineLatestWith(modifiedTemplates$),
    map(([ids, modIds]) =>
        Array.from(ids.values())
            .map((x) => modIds.find((m) => m.id === x))
            .filter((x) => x !== undefined)
    ),
    distinctUntilChanged((prev, curr) => new Set(prev).symmetricDifference(new Set(curr)).size === 0)
);
const originalTemplates$ = templatesAndModifiedIds$.pipe(map((ids) => ids.filter((x) => x.originalId === undefined).map((x) => x.id)));
const visibleOriginalTemplateIds$ = templatesIdsInViewObs.pipe(
    combineLatestWith(originalTemplates$),
    map(([ids, origIds]) => Array.from(ids.values()).filter((x) => origIds.find((o) => o === x))),
    distinctUntilChanged((prev, curr) => new Set(prev).symmetricDifference(new Set(curr)).size === 0)
);

async function addNewTemplate(file: File, loader: ObservedValueOf<typeof templateLoaderReadyObs>, title: string, canvasId: string, x: number, y: number) {
    await loader.addFile(file, title, canvasId, x, y);
    const template = await lastValueFrom(getTemplateByTitle$(title));
}

// TODO when shouldConvertColors is switched, enabled or disable `template` vs `modifiedTemplate`
function getProcessedTemplateWithModifications(id: number) {
    return getTemplateById$(id)
        .pipe(
            filter((x) => x.enabled),
            combineLatestWith(modifiedTemplates$),
            filter(([a, b]) => !b.find((x) => x.originalId === a.imageId)),
            map(([x]) => x),
            combineLatestWith(getTemplateCanvas$(id).pipe(switchMap((canvas) => from(canvasToBlob(canvas))))),
            map(([template, blob]) => [template, new File([blob], `${template.title}-modified-${template.imageId.toString()}`)] as const),
            combineLatestWith(templateLoaderReadyObs)
        )
        .pipe(
            switchMap(([[template, file], loader]) => {
                const title = `${template.title}-modified-imageoverlay-${template.imageId.toString()}`;
                return from(loader.addFile(file, title, template.canvasId, template.x, template.y)).pipe(map(() => title));
            }),
            switchMap((title) => {
                return getTemplateByTitle$(title);
            }),
            tap((x) => {
                const values = new Map(templateModificationMapping[0]());
                values.set(id, x.imageId);
                templateModificationMapping[1](values);
            }),
            combineLatestWith(templateLoaderReadyObs, getTemplateById$(id)),
            tap(([x, loader, template]) => {
                loader.changeTemplate(template.title, { enabled: false });
            }),
            map(([x]) => x.imageId)
        );

    // return templateModificationMapping$.pipe(
    //     map((mapping) => mapping.get(id)),
    //     switchMap((newId) => {
    //         if (newId === undefined) {
    //             // Create new `modified template from target template`
    //             return
    //         }
    //         return of(newId);
    //     }),
    //     combineLatestWith(
    //         getTemplateImageDataWithModificationsApplied$(id).pipe(
    //             switchMap((x) => {
    //                 const c = document.createElement('canvas');
    //                 c.width = x.width;
    //                 c.height = x.height;
    //                 const ctx = c.getContext('2d');
    //                 ctx?.putImageData(x, 0, 0);
    //                 return from(canvasToBlob(c));
    //             }),
    //             map((blob) => new File([blob], `modified-image`))
    //         ),
    //         templateLoaderReadyObs
    //     ),
    //     switchMap(([newId, imageFile, loader]) => from(loader.updateFile(newId, imageFile)).pipe(map(() => [id, newId] as const)))
    // );
}

const templatesWithModifications$ = visibleOriginalTemplateIds$.pipe(
    combineLatestWith(modifiedTemplates$),
    map(([ids, modifiedIds]) => ids.filter((x) => !modifiedIds.find((m) => m.originalId === x))),
    distinctUntilChanged((prev, curr) => new Set(prev).symmetricDifference(new Set(curr)).size === 0),
    concatMap((ids) => forkJoin(ids.map((x) => getProcessedTemplateWithModifications(x))))
);
templatesWithModifications$.subscribe((...args) => {
    console.log('templatesWithModifications$', ...args);
});

const applyModifications$ = visibleModifiedTemplateIds$.pipe(
    concatMap((ids) =>
        forkJoin(
            ids.map((id) =>
                getTemplateImageDataWithModificationsApplied$(id.originalId).pipe(
                    tap((x) => console.log('tap1', x)),
                    switchMap((x) => {
                        const c = document.createElement('canvas');
                        c.width = x.width;
                        c.height = x.height;
                        const ctx = c.getContext('2d');
                        ctx?.putImageData(x, 0, 0);
                        return from(canvasToBlob(c));
                    }),
                    map((blob) => new File([blob], `modified-image`)),
                    combineLatestWith(templateLoaderReadyObs),
                    switchMap(([imageFile, loader]) => from(loader.updateFile(id.id, imageFile)).pipe(map(() => [id] as const)))
                )
            )
        )
    )
);
applyModifications$.subscribe((x) => console.log('applyModifications$', x));

const createModifiedTemplateFromIdSubject = new Subject<number>();

createModifiedTemplateFromIdSubject.pipe(concatMap((x) => ''));
