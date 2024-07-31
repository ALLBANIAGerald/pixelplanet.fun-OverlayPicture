import { useSignal } from '../../store/useSignal';
import { selectPageStateCanvasId, templateByIdObs } from '../../utils/getPageReduxStore';
import { templateLoaderReadyObs, templatesIdsInViewObs, viewCenterSignal, viewportSizeSignal, viewScaleSignal } from '../../store/slices/gameSlice';
import { OverlayImage, dragModeEnabled } from '../../store/slices/overlaySlice';
import { Accessor, createEffect, createMemo, createSignal, For, from, onCleanup, Show, untrack } from 'solid-js';
import { gameCoordsToScreen, screenToGameCoords } from '../../utils/coordConversion';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';
import { GM_xmlhttpRequest } from 'vite-plugin-monkey/dist/client';
import { pictureConverterApi } from '../../pictureConversionApi';
import { createQuery } from '@tanstack/solid-query';
import { createDraggable, DragDropProvider, DragDropSensors, transformStyle } from '@thisbeyond/solid-dnd';
import { viewPortIsMouseDown$ } from '../../gameInjection/viewport';

async function loadUrlToImage(url: string) {
    return new Promise<HTMLImageElement | Error>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => {
            resolve(img);
        };
        img.onerror = () => {
            resolve(new Error('Image load error'));
        };
    });
}

function queryLoadOverlayImageToImage(overlayImageId: Accessor<number>) {
    const image = createMemo(() => imagesById()[overlayImageId()]);
    const fileUrl = createMemo(() => {
        const i = image();
        if (!i) return;
        return useImageFileUrl(() => i.imageFile)();
    });
    return createQuery(() => ({
        queryKey: ['overlayImage', overlayImageId(), 'queryLoadOverlayImageToImage'],
        queryFn: async () => {
            const url = fileUrl();
            if (!url) throw new Error('Missing fileUrl!');

            const img = await loadUrlToImage(url);
            if (img instanceof Error) return img;
            return getImageDataFromLoadedImage(img);
        },
        staleTime: Infinity,
        gcTime: Infinity,
        enabled: () => !!fileUrl(),
    }));
}

function useImageFileUrl(imageFile: Accessor<OverlayImage['imageFile']>) {
    const fileUrl = createMemo(() => {
        const imgf = imageFile();
        const url = imgf.type === 'file' ? URL.createObjectURL(imgf.file) : imgf.url;
        onCleanup(() => {
            if (imgf.type === 'file') URL.revokeObjectURL(url);
        });
        return url;
    });
    return fileUrl;
}

function fetchImageFallback(fileUrl: string, abortSignal?: AbortSignal) {
    return new Promise<Blob | Error>((resolve) => {
        const reqAbort = GM_xmlhttpRequest({
            url: fileUrl,
            responseType: 'blob',
            headers: {
                Host: new URL(fileUrl).host,
            },
            onload: (event) => {
                resolve(event.response);
            },
            onerror: (e) => {
                resolve(new Error(e.error));
            },
        });
        abortSignal?.addEventListener('abort', () => {
            reqAbort.abort();
        });
    });
}

function queryImageFallback(overlayImageId: Accessor<number>) {
    const image = createMemo(() => imagesById()[overlayImageId()]);
    const imageUrl = createMemo(() => {
        const imageFile = image()?.imageFile;
        if (imageFile?.type === 'url') return imageFile.url;
    });
    const query = createQuery(() => ({
        queryKey: ['overlayImage', overlayImageId(), 'queryImageFallback', 'fetchBlob'],
        queryFn: async (context) => {
            const url = imageUrl();
            if (!url) throw new Error('Missing imageUrl');

            const result = await fetchImageFallback(url, context.signal);
            return result;
        },
        staleTime: Infinity,
        gcTime: Infinity,
        enabled: () => !!imageUrl(),
    }));

    const queryBlob = createMemo(() => (query.data instanceof Error ? undefined : query.data));
    const blobUrl = createMemo(() => {
        const blob = queryBlob();
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        onCleanup(() => {
            URL.revokeObjectURL(url);
        });
        return url;
    });

    return createQuery(() => ({
        queryKey: ['overlayImage', overlayImageId(), 'queryImageFallback', 'loadImage'],
        queryFn: async () => {
            const url = blobUrl();
            if (!url) throw new Error('Missing fileUrl!');

            const img = await loadUrlToImage(url);
            if (img instanceof Error) return img;
            return getImageDataFromLoadedImage(img);
        },
        staleTime: Infinity,
        gcTime: Infinity,
        enabled: () => !!queryBlob(),
    }));
}

function getImageDataFromLoadedImage(img: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Can't get context from canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height);
}

function useOverlayImageImageData(overlayImageId: Accessor<number>) {
    const loadedImageQuery = queryLoadOverlayImageToImage(overlayImageId);
    const isError = createMemo(() => loadedImageQuery.data instanceof Error);
    const fallbackQuery = createMemo(() => {
        if (!isError()) return;
        return queryImageFallback(overlayImageId);
    });
    return createMemo(() => {
        if (loadedImageQuery.data && !(loadedImageQuery.data instanceof Error)) return loadedImageQuery.data;
        const fQuery = fallbackQuery();
        if (fQuery && fQuery.data && !(fQuery.data instanceof Error)) return fQuery.data;
    });
}

function useProcessImageDataModifications(
    overlayImageId: Accessor<number>,
    inputImageData: Accessor<ImageData>,
    palette: Accessor<[number, number, number][]>,
    modifierShouldConvertColors: Accessor<boolean>,
    modifierImageBrightness: Accessor<number>
) {
    const canvasId = useSignal(selectPageStateCanvasId);
    return createQuery(() => ({
        queryKey: ['overlayImage', overlayImageId(), 'useProcessImageDataModifications', canvasId(), palette(), modifierImageBrightness()],
        queryFn: () => {
            return pictureConverterApi.applyModificationsToImageData(palette(), inputImageData(), modifierImageBrightness());
        },
        staleTime: Infinity,
        gcTime: 30 * 1000,
    }));
}

function OverlayImageWithControls(props: { template: { imageId: number; x: number; y: number; height: number; width: number } }) {
    const draggable = createDraggable(props.template.imageId);

    const viewPortSize = useSignal(viewportSizeSignal);
    const viewCenterGameCoords = useSignal(viewCenterSignal);
    const viewScale = useSignal(viewScaleSignal);
    const [dragStartCoords, setDragStartCoords] = createSignal<{ x: number; y: number } | undefined>(undefined);
    createEffect(() => {
        if (draggable.isActiveDraggable) untrack(() => setDragStartCoords(props.template));
    });
    const gameCoords = createMemo(() => {
        if (draggable.isActiveDraggable) return dragStartCoords() ?? { x: props.template.x, y: props.template.y };
        return { x: props.template.x, y: props.template.y };
    });
    const screenOffset = createMemo(() => gameCoordsToScreen(gameCoords(), viewPortSize(), viewCenterGameCoords(), viewScale()));
    const sizeOnScreen = createMemo(() => ({ width: props.template.width * viewScale(), height: props.template.height * viewScale() }));
    const dragMode = useSignal(dragModeEnabled);
    const dragButtonCoordsRelativeToImage = createMemo(() => {
        const centerGame = viewCenterGameCoords();
        const gameC = gameCoords();
        const leftGame = gameC.x;
        const topGame = gameC.y;
        const rightGame = gameC.x + props.template.width;
        const bottomGame = gameC.y + props.template.height;
        let x = centerGame.x < leftGame ? leftGame : centerGame.x;
        x = x > rightGame ? rightGame : x;
        let y = centerGame.y < topGame ? topGame : centerGame.y;
        y = y > bottomGame ? bottomGame : y;
        const imageOnScreen = screenOffset();
        const buttonOnScreen = gameCoordsToScreen({ x, y }, viewPortSize(), viewCenterGameCoords(), viewScale());
        return { x: buttonOnScreen.clientX - imageOnScreen.clientX, y: buttonOnScreen.clientY - imageOnScreen.clientY };
    });
    const viewPortIsMouseDown = from(viewPortIsMouseDown$);
    const loader = from(templateLoaderReadyObs);
    return (
        <Show when={dragMode()}>
            <div
                ref={draggable.ref}
                class="tw-pointer-events-none tw-relative tw-left-[--left-offset] tw-top-[--top-offset] tw-h-[--height] tw-w-[--width] tw-origin-top-left"
                style={{
                    ...transformStyle(draggable.transform),
                    '--left-offset': `${screenOffset().clientX.toString()}px`,
                    '--top-offset': `${screenOffset().clientY.toString()}px`,
                    '--width': `${sizeOnScreen().width.toString()}px`,
                    '--height': `${sizeOnScreen().height.toString()}px`,
                }}
            >
                <div class="tw-pointer-events-auto tw-flex -tw-translate-y-full">
                    <label for="template-file">
                        <div role="button" class="tw-btn tw-btn-primary tw-h-12 tw-w-12 tw-p-0">
                            <svg xmlns="http://www.w3.org/2000/svg" class="tw-h-6 tw-w-6" viewBox="0 -960 960 960" fill="currentColor">
                                <path d="M720-330q0 104-73 177T470-80q-104 0-177-73t-73-177v-370q0-75 52.5-127.5T400-880q75 0 127.5 52.5T580-700v350q0 46-32 78t-78 32q-46 0-78-32t-32-78v-370h80v370q0 13 8.5 21.5T470-320q13 0 21.5-8.5T500-350v-350q-1-42-29.5-71T400-800q-42 0-71 29t-29 71v370q-1 71 49 120.5T470-160q70 0 119-49.5T640-330v-390h80v390Z" />
                            </svg>
                            <input
                                id="template-file"
                                accept="image/*"
                                type="file"
                                class="tw-hidden"
                                onchange={(e) => {
                                    if (!e.target.files) return;
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    void loader()?.updateFile(props.template.imageId, file);
                                }}
                            />
                        </div>
                    </label>
                </div>
                <div
                    class="tw-absolute tw-left-[--left-offset] tw-top-[--top-offset] -tw-translate-x-1/2 -tw-translate-y-1/2 tw-transition-[left,top] [transition-timing-function:linear(0.2_0%,1_100%)]"
                    classList={{
                        'tw-pointer-events-auto': !viewPortIsMouseDown(),
                    }}
                    style={{
                        '--left-offset': `${dragButtonCoordsRelativeToImage().x.toString()}px`,
                        '--top-offset': `${dragButtonCoordsRelativeToImage().y.toString()}px`,
                    }}
                >
                    <button class="tw-btn tw-btn-primary tw-h-12 tw-w-12 tw-p-0" {...draggable.dragActivators}>
                        <svg xmlns="http://www.w3.org/2000/svg" class="tw-h-6 tw-w-6" viewBox="0 -960 960 960" fill="currentColor">
                            <path d="M480-80 310-250l57-57 73 73v-206H235l73 72-58 58L80-480l169-169 57 57-72 72h206v-206l-73 73-57-57 170-170 170 170-57 57-73-73v206h205l-73-72 58-58 170 170-170 170-57-57 73-73H520v205l72-73 58 58L480-80Z" />
                        </svg>
                    </button>
                </div>
            </div>
        </Show>
    );
}

function OverlayImageRender(props: { imageId: number }) {
    const templatesById = from(templateByIdObs);
    const template = createMemo(() => templatesById()?.get(props.imageId));

    return <Show when={template()}>{(template) => <OverlayImageWithControls template={template()} />}</Show>;
}

function useMoveImageTo() {
    const windowSize = useSignal(windowInnerSize);
    const viewCenter = useSignal(viewCenterSignal);
    const viewScale = useSignal(viewScaleSignal);
    const readyTemplateLoader = from(templateLoaderReadyObs);
    const templatesById = from(templateByIdObs);
    return (templateId: number, screenX: number, screenY: number) => {
        const template = templatesById()?.get(templateId);
        if (!template) return;
        const gameCoords = screenToGameCoords({ clientX: screenX, clientY: screenY }, windowSize(), viewCenter(), viewScale());
        readyTemplateLoader()?.changeTemplate(template.title, { x: Math.round(gameCoords.x), y: Math.round(gameCoords.y) });
    };
}

export function OverlayImages() {
    const imageIds = from(templatesIdsInViewObs);
    const moveImageTo = useMoveImageTo();
    const dragMode = useSignal(dragModeEnabled);
    return (
        <div id="overlay-images-wrapper" class="tw-h-0 tw-w-0">
            <DragDropProvider
                onDragMove={(e) => {
                    const id = typeof e.draggable.id === 'string' ? parseInt(e.draggable.id) : e.draggable.id;
                    moveImageTo(id, e.draggable.transformed.x, e.draggable.transformed.y);
                }}
            >
                <Show when={dragMode()}>
                    <DragDropSensors />
                </Show>
                <For each={[...(imageIds() ?? [])]}>{(imageId) => <OverlayImageRender imageId={imageId} />}</For>;
            </DragDropProvider>
        </div>
    );
}
