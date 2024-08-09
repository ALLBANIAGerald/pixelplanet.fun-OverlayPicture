import logger from '../../handlers/logger';
import localforage from 'localforage';
import { Signal } from 'signal-polyfill';
import { getStoredValue } from '../../store/getStoredData';
import { stateCanvasPaletteObs, selectPageStateCanvasId, templateByIdObs, templatesIdsObs, canvasPaletteReservedOffset$ } from '../../utils/getPageReduxStore';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';

import { templateLoaderReadyObs, templatesIdsInViewObs, viewCenterSignal, viewScaleSignal } from './gameSlice';
import { gameCoordsToScreen, screenToGameCoords } from '../../utils/coordConversion';
import { createSignalComputed, createSignalState } from '../../utils/signalPrimitives/createSignal';
import {
    combineLatest,
    combineLatestWith,
    concatMap,
    distinctUntilChanged,
    filter,
    from,
    lastValueFrom,
    map,
    mergeAll,
    Observable,
    ObservedValueOf,
    of,
    pairwise,
    shareReplay,
    startWith,
    Subject,
    switchMap,
    take,
    withLatestFrom,
    tap,
} from 'rxjs';
import { pictureConverterApi } from '../../pictureConversionApi';
import { signalToObs } from '../obsToSignal';
import { traceLog$ } from '../log$';
import { unsafeWindow } from 'vite-plugin-monkey/dist/client';
import { proxy } from 'comlink';

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
const templateModificationSettings = persistedSignal(new Map<number, { convertColors: boolean; imageBrightness: number }>(), 'templateModificationSettings');
export function updateModificationSettings(templateId: number, settings: { convertColors?: boolean; imageBrightness?: number }) {
    modifiedTemplatesIds$.pipe(map((m) => m.find((x) => x.id === templateId)?.originalId ?? templateId)).subscribe((targetTemplateId) => {
        const [get, set] = templateModificationSettings;
        const prev = get();
        const prevInstance = prev.get(targetTemplateId);
        const newConvertColors = settings.convertColors ?? prevInstance?.convertColors ?? false;
        const newBrightness = settings.imageBrightness ?? prevInstance?.imageBrightness ?? 0;
        set(new Map(prev).set(targetTemplateId, { convertColors: newConvertColors, imageBrightness: newBrightness }));
    });
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
        tap((i) => {
            // TODO somehow we can't hit this... After `getTemplate` returns promise, it never emits observable
            console.warn(i);
        }),
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

export const modifiedTemplatesIds$ = templatesAndModifiedIds$.pipe(
    map((ids) => ids.filter((x) => x.originalId !== undefined)),
    distinctUntilChanged((prev, curr) => new Set(prev.map((x) => x.id)).symmetricDifference(new Set(curr.map((x) => x.id))).size === 0)
);
const visibleModifiedTemplateIds$ = templatesIdsInViewObs.pipe(
    combineLatestWith(modifiedTemplatesIds$),
    map(([ids, modIds]) =>
        Array.from(ids.values())
            .map((x) => modIds.find((m) => m.id === x))
            .filter((x) => x !== undefined)
    ),
    distinctUntilChanged((prev, curr) => new Set(prev).symmetricDifference(new Set(curr)).size === 0)
);
const originalTemplatesIds$ = templatesAndModifiedIds$.pipe(
    map((ids) => ids.filter((x) => x.originalId === undefined).map((x) => x.id)),
    distinctUntilChanged((prev, curr) => new Set(prev).symmetricDifference(new Set(curr)).size === 0)
);
const visibleOriginalTemplateIds$ = templatesIdsInViewObs.pipe(
    combineLatestWith(originalTemplatesIds$),
    map(([ids, origIds]) => Array.from(ids.values()).filter((x) => origIds.find((o) => o === x))),
    distinctUntilChanged((prev, curr) => new Set(prev).symmetricDifference(new Set(curr)).size === 0)
);

const templateModificationSettings$ = signalToObs(templateModificationSettings);
const templateModificationSettingsStream$ = modifiedTemplatesIds$.pipe(
    mergeAll(),
    combineLatestWith(templateModificationSettings$),
    map(([id, settings]) => ({ id, settings: settings.get(id.originalId) })),
    filter((x) => x.settings !== undefined),
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    map((x) => ({ ...x, settings: x.settings! }))
);
const templateModSettingsConvertEnabledStream$ = templateModificationSettingsStream$.pipe(filter((x) => x.settings.convertColors));

async function addNewTemplate(file: File, loader: ObservedValueOf<typeof templateLoaderReadyObs>, title: string, canvasId: string, x: number, y: number) {
    await loader.addFile(file, title, canvasId, x, y);
    const template = await lastValueFrom(getTemplateByTitle$(title));
}

// TODO when shouldConvertColors is switched, enabled or disable `template` vs `modifiedTemplate`
visibleOriginalTemplateIds$
    .pipe(
        combineLatestWith(modifiedTemplatesIds$),
        map(([ids, modifiedIds]) => ids.filter((x) => !modifiedIds.find((m) => m.originalId === x))),
        distinctUntilChanged((prev, curr) => new Set(prev).symmetricDifference(new Set(curr)).size === 0),
        traceLog$('templatesWithModifications$ ids'),
        switchMap((ids) =>
            combineLatest(
                ids.map((id) =>
                    of(id)
                        .pipe(
                            withLatestFrom(getTemplateById$(id)),
                            traceLog$('getProcessedTemplateWithModifications$ template'),
                            combineLatestWith(templateModificationSettingsForId$(id).pipe(filter((x) => x.convertColors))),
                            traceLog$('getProcessedTemplateWithModifications$ template-convert'),
                            filter(([, modificationSettings]) => modificationSettings.convertColors),
                            map(([[, template]]) => template),
                            take(1),
                            combineLatestWith(getTemplateCanvas$(id).pipe(switchMap((canvas) => from(canvasToBlob(canvas)))))
                        )
                        .pipe(
                            map(([template, blob]) => [template, new File([blob], `${template.title}-modified-${template.imageId.toString()}`)] as const),
                            traceLog$('getProcessedTemplateWithModifications$ new file'),
                            combineLatestWith(templateLoaderReadyObs),
                            traceLog$('getProcessedTemplateWithModifications$ with loader'),
                            switchMap(([[ogTemplate, file], loader]) => {
                                const title = `${ogTemplate.title}-modified-imageoverlay-${ogTemplate.imageId.toString()}`;
                                return from(
                                    (async () => {
                                        await loader.addFile(file, title, ogTemplate.canvasId, ogTemplate.x, ogTemplate.y);
                                        loader.changeTemplate(ogTemplate.title, { enabled: false });
                                        const newTemplate = await lastValueFrom(getTemplateByTitle$(title));
                                        return newTemplate;
                                    })()
                                );
                            }),
                            traceLog$('getProcessedTemplateWithModifications$ result')
                        )
                )
            )
        )
    )
    .subscribe();

const modificationCanvas$ = new Observable<HTMLCanvasElement>((subscriber) => {
    subscriber.next(document.createElement('canvas'));
    subscriber.complete();
}).pipe(shareReplay(1));
const imageDataToBlobSubject = new Subject<ImageData>();
const imageDataToBlob$ = imageDataToBlobSubject.pipe(
    combineLatestWith(modificationCanvas$),
    concatMap(([imageData, canvas]) => {
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx?.putImageData(imageData, 0, 0);
        return from(canvasToBlob(canvas)).pipe(map((blob) => ({ blob, imageData })));
    })
);
function convertImageDataToBlob$(imageData: ImageData) {
    queueMicrotask(() => {
        imageDataToBlobSubject.next(imageData);
    });
    return imageDataToBlob$.pipe(
        filter((x) => x.imageData === imageData),
        take(1),
        map((x) => x.blob)
    );
}

export function templateModificationSettingsForId$(templateId: number) {
    return templateModificationSettings$.pipe(
        combineLatestWith(modifiedTemplatesIds$.pipe(map((m) => m.find((x) => x.id === templateId)?.originalId ?? templateId))),
        map(([settingsMap, templateId]) => settingsMap.get(templateId)),
        filter((x) => x !== undefined),
        distinctUntilChanged()
    );
}

function getTemplateImageData$(templateId: number) {
    return getTemplateCanvas$(templateId).pipe(
        withLatestFrom(getTemplateById$(templateId)),
        map(([canvas, template]) => canvas.getContext('2d')?.getImageData(0, 0, template.width, template.height, { colorSpace: 'srgb' })),
        filter((x) => x !== undefined)
    );
}

// Update existing on screen modified templates
export function processModifiedTemplate$(id: { id: number; originalId: number }) {
    return templateModificationSettingsForId$(id.originalId).pipe(
        filter((x) => x.convertColors),
        switchMap((x) => of(x).pipe(combineLatestWith(getTemplateImageData$(id.originalId).pipe(take(1)), getTemplateImageData$(id.id).pipe(take(1))))),
        combineLatestWith(stateCanvasPaletteObs, canvasPaletteReservedOffset$),
        switchMap(
            ([[modificationSettings, imageData, baseImageData], palette, reservedOffset]) =>
                new Observable<ImageData>((subscriber) => {
                    const processingId = Date.now();
                    const teardown = () => {
                        void pictureConverterApi.cancelProcessById(processingId);
                    };
                    subscriber.add(teardown);
                    void pictureConverterApi
                        .applyModificationsToImageData(
                            processingId,
                            palette,
                            reservedOffset,
                            imageData,
                            baseImageData,
                            modificationSettings.imageBrightness,
                            proxy((partialImageData) => {
                                subscriber.next(partialImageData);
                            })
                        )
                        .then((imageData) => {
                            subscriber.next(imageData);
                            subscriber.remove(teardown);
                            subscriber.complete();
                        });
                })
        ),
        switchMap((x) => convertImageDataToBlob$(x)),
        map((blob) => new File([blob], `modified-image`)),
        combineLatestWith(of(id)),
        combineLatestWith(templateLoaderReadyObs),
        switchMap(([[imageFile, id], loader]) => loader.updateFile(id.id, imageFile))
    );
}

function filterJustEnabledTemplate(id: number) {
    return getTemplateById$(id).pipe(
        map((template) => template.enabled),
        startWith(true),
        pairwise(),
        map(([a, b]) => !a && b),
        distinctUntilChanged(),
        filter((x) => !!x)
    );
}

// Sync position between modified and original
originalTemplatesIds$
    .pipe(
        switchMap((ids) =>
            combineLatest(
                ids.map((originalId) =>
                    of(originalId).pipe(
                        combineLatestWith(modifiedTemplatesIds$),
                        map(([, modifiedIds]) => modifiedIds.find((x) => x.originalId === originalId)),
                        filter((x) => x !== undefined),
                        distinctUntilChanged((a, b) => a.id === b.id),
                        switchMap((id) =>
                            of(id).pipe(
                                combineLatestWith(getTemplateById$(id.id)),
                                combineLatestWith(getTemplateById$(id.originalId)),
                                map(([[, modTemplate], ogTemplate]) => {
                                    const newData: Parameters<NonNullable<typeof unsafeWindow.templateLoader>['changeTemplate']>['1'] & { title: string } = { title: modTemplate.title };
                                    if (ogTemplate.canvasId !== modTemplate.canvasId) newData.canvasId = ogTemplate.canvasId;
                                    if (ogTemplate.x !== modTemplate.x) newData.x = ogTemplate.x;
                                    if (ogTemplate.y !== modTemplate.y) newData.y = ogTemplate.y;
                                    return newData;
                                }),
                                filter((x) => Object.keys(x).length > 1)
                            )
                        ),
                        combineLatestWith(templateLoaderReadyObs),
                        tap(([modDiff, loader]) => {
                            loader.changeTemplate(modDiff.title, modDiff);
                        })
                    )
                )
            )
        )
    )
    .subscribe();

// TODO sync `convert colors` variable with `original/modified` template `enabled` states
// When original is enabled, if convert is true, set it to false
// When modified is enabled, if convert is false, set it to true
// When convert is true, if original is enabled, enable modified and disable og
// When convert is false, if modified is enabled, enable og and disable modified
function syncEnabledStateWithConvertColors(templateId: number) {
    const isEnabled$ = getTemplateById$(templateId).pipe(
        map((x) => x.enabled),
        distinctUntilChanged()
    );
    const titleById$ = (id: number) =>
        getTemplateById$(id).pipe(
            map((x) => x.title),
            distinctUntilChanged()
        );
    const justEnabled$ = filterJustEnabledTemplate(templateId);
    const isOriginal$ = originalTemplatesIds$.pipe(map((id) => !!id.find((x) => x === templateId)));
    const isModified$ = modifiedTemplatesIds$.pipe(map((id) => !!id.find((x) => x.id === templateId)));
    const matchingModifiedTemplateId$ = modifiedTemplatesIds$.pipe(
        map((ids) => ids.find((id) => id.id === templateId || id.originalId === templateId)),
        filter((x) => x !== undefined)
    );
    const isConvertEnabled$ = templateModificationSettingsForId$(templateId).pipe(map((x) => x.convertColors));
    const isConvertJustEnabled$ = isConvertEnabled$.pipe(
        startWith(true),
        pairwise(),
        map(([a, b]) => !a && b),
        distinctUntilChanged(),
        filter((x) => !!x)
    );
    const isConvertJustDisabled$ = isConvertEnabled$.pipe(
        startWith(false),
        pairwise(),
        map(([a, b]) => a && !b),
        distinctUntilChanged(),
        filter((x) => !!x)
    );

    const syncOgEnabledConvertOff = isOriginal$.pipe(
        filter((x) => x),
        switchMap(() => justEnabled$),
        withLatestFrom(isConvertEnabled$),
        filter(([, x]) => x),
        tap(() => {
            updateModificationSettings(templateId, { convertColors: false });
        })
    );

    const syncModEnabledConvertOn = isModified$.pipe(
        filter((x) => x),
        switchMap(() => justEnabled$),
        withLatestFrom(isConvertEnabled$),
        filter(([, isConvertEnabled]) => !isConvertEnabled),
        tap(() => {
            updateModificationSettings(templateId, { convertColors: true });
        })
    );

    const syncConvertOnModEnabled = isConvertJustEnabled$.pipe(
        withLatestFrom(isOriginal$, isEnabled$),
        filter(([, isOg, isEnabled]) => isOg && isEnabled),
        withLatestFrom(matchingModifiedTemplateId$),
        switchMap(([, id]) =>
            titleById$(id.originalId).pipe(
                map((ogTitle) => ({ ogTitle, id })),
                switchMap(({ id, ogTitle }) => titleById$(id.id).pipe(map((mTitle) => ({ mTitle, ogTitle, id }))))
            )
        ),
        combineLatestWith(templateLoaderReadyObs),
        tap(([{ mTitle, ogTitle }, loader]) => {
            loader.changeTemplate(mTitle, { enabled: true });
            loader.changeTemplate(ogTitle, { enabled: false });
        })
    );

    const syncConvertOffOgEnabled = isConvertJustDisabled$.pipe(
        withLatestFrom(isModified$, isEnabled$),
        filter(([, isModified, isEnabled]) => isModified && isEnabled),
        withLatestFrom(matchingModifiedTemplateId$),
        switchMap(([, id]) =>
            titleById$(id.originalId).pipe(
                map((ogTitle) => ({ ogTitle, id })),
                switchMap(({ id, ogTitle }) => titleById$(id.id).pipe(map((mTitle) => ({ mTitle, ogTitle, id }))))
            )
        ),
        combineLatestWith(templateLoaderReadyObs),
        tap(([{ mTitle, ogTitle }, loader]) => {
            loader.changeTemplate(ogTitle, { enabled: true });
            loader.changeTemplate(mTitle, { enabled: false });
        })
    );

    return combineLatest([syncOgEnabledConvertOff, syncModEnabledConvertOn, syncConvertOnModEnabled, syncConvertOffOgEnabled]);
}

templatesIdsObs.pipe(switchMap((ids) => combineLatest([...ids].map((id) => syncEnabledStateWithConvertColors(id))))).subscribe();

// Sync turned on state between modified and original
originalTemplatesIds$
    .pipe(
        switchMap((ids) =>
            combineLatest(
                ids.map((id) =>
                    of(id).pipe(
                        switchMap(() => filterJustEnabledTemplate(id)),
                        withLatestFrom(modifiedTemplatesIds$),
                        map(([, modifiedIds]) => modifiedIds.find((x) => x.originalId === id)),
                        filter((x) => x !== undefined),
                        switchMap((id) =>
                            of(id).pipe(
                                withLatestFrom(getTemplateById$(id.id)),
                                filter(([, x]) => x.enabled),
                                map(([, template]) => template.title)
                            )
                        ),
                        combineLatestWith(templateLoaderReadyObs),
                        tap(([title, loader]) => {
                            loader.changeTemplate(title, { enabled: false });
                        })
                    )
                )
            )
        )
    )
    .subscribe();

modifiedTemplatesIds$
    .pipe(
        switchMap((ids) =>
            combineLatest(
                ids.map((id) =>
                    of(id).pipe(
                        switchMap(() => filterJustEnabledTemplate(id.id)),
                        withLatestFrom(originalTemplatesIds$),
                        map(([, originalIds]) => originalIds.find((x) => x === id.originalId)),
                        filter((x) => x !== undefined),
                        switchMap((id) =>
                            of(id).pipe(
                                withLatestFrom(getTemplateById$(id)),
                                filter(([, x]) => x.enabled),
                                map(([, template]) => template.title)
                            )
                        ),
                        combineLatestWith(templateLoaderReadyObs),
                        tap(([title, loader]) => {
                            loader.changeTemplate(title, { enabled: false });
                        })
                    )
                )
            )
        )
    )
    .subscribe();

// Delete modified templates when original is deleted
const modifiedTemplatesIdWithoutOriginal$ = modifiedTemplatesIds$.pipe(
    mergeAll(),
    combineLatestWith(originalTemplatesIds$),
    filter(([id, originalIds]) => !originalIds.find((x) => x === id.originalId)),
    map((x) => x[0].id)
);
modifiedTemplatesIdWithoutOriginal$
    .pipe(
        switchMap((id) => getTemplateById$(id)),
        combineLatestWith(templateLoaderReadyObs)
    )
    .subscribe(([{ title }, loader]) => {
        loader.deleteTemplate(title);
    });
