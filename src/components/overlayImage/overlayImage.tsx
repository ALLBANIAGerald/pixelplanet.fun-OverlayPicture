import { useSignal } from '../../store/useSignal';
import { selectPageStateCanvasId, selectPageStateCanvasPalette } from '../../utils/getPageReduxStore';
import { viewCenterSignal, viewScaleSignal } from '../../store/slices/gameSlice';
import { isShowSmallPixelsActiveSignal, OverlayImage, overlayImagesById, overlayTransparencySignal, overlayImagesIdsVisibleOnScreen } from '../../store/slices/overlaySlice';
import { Accessor, createMemo, createRenderEffect, createSignal, For, Match, onCleanup, Show, Switch } from 'solid-js';
import { gameCoordsToScreen } from '../../utils/coordConversion';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';
import { GM_xmlhttpRequest } from 'vite-plugin-monkey/dist/client';
import { pictureConverterApi } from '../../pictureConversionApi';
import { createQuery } from '@tanstack/solid-query';

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
    const imagesById = useSignal(overlayImagesById);
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
    const imagesById = useSignal(overlayImagesById);
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
        queryKey: ['overlayImage', overlayImageId(), 'useProcessImageDataModifications', canvasId(), palette(), modifierShouldConvertColors(), modifierImageBrightness()],
        queryFn: () => {
            return pictureConverterApi.applyModificationsToImageData(palette(), inputImageData(), modifierShouldConvertColors(), modifierImageBrightness());
        },
        staleTime: Infinity,
        gcTime: 30 * 1000,
    }));
}

function useProcessImageDataUseSmallPixels(overlayImageId: Accessor<number>, inputImageData: Accessor<ImageData>) {
    const canvasId = useSignal(selectPageStateCanvasId);
    return createQuery(() => ({
        queryKey: ['overlayImage', overlayImageId(), canvasId()],
        queryFn: () => {
            return pictureConverterApi.applySmallPixelsModifier(inputImageData());
        },
        staleTime: Infinity,
        gcTime: 30 * 1000,
    }));
}

const OverlayImageCanvas = (props: { image: OverlayImage; imageData: ImageData }) => {
    const viewScale = useSignal(viewScaleSignal);
    const modifierSmallPixels = useSignal(isShowSmallPixelsActiveSignal);
    const palette = useSignal(selectPageStateCanvasPalette);
    const modifiedImageDataQuery = useProcessImageDataModifications(
        () => props.image.id,
        () => props.imageData,
        palette,
        () => props.image.modifications.convertColors.enabled,
        () => props.image.modifications.overrideBrightness.brightness
    );
    const shouldShowSmallPixels = createMemo(() => modifierSmallPixels() && viewScale() >= 5);
    const modifiedImageData = createMemo(() => modifiedImageDataQuery.data);
    const smallPixelsQuery = createMemo(() => {
        const showSmall = shouldShowSmallPixels();
        const imageData = modifiedImageData() ?? props.imageData;
        if (!showSmall) return;
        return useProcessImageDataUseSmallPixels(
            () => props.image.id,
            () => imageData
        );
    });
    const smallPixelsImageData = createMemo(() => smallPixelsQuery()?.data);
    return (
        <Switch fallback={<OverlayImageCanvasFromImageData image={props.image} imageData={props.imageData} smallPixels={false} />}>
            <Match when={smallPixelsImageData()}>{(smallPixelsImageData) => <OverlayImageCanvasFromImageData image={props.image} imageData={smallPixelsImageData()} smallPixels={true} />}</Match>
            <Match when={modifiedImageData()}>{(modifiedImageData) => <OverlayImageCanvasFromImageData image={props.image} imageData={modifiedImageData()} smallPixels={false} />}</Match>
        </Switch>
    );
};

function OverlayImageCanvasFromImageData(props: { image: OverlayImage; imageData: ImageData; smallPixels: boolean }) {
    const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
    const windowSize = useSignal(windowInnerSize);
    const viewCenterGameCoords = useSignal(viewCenterSignal);
    const viewScale = useSignal(viewScaleSignal);
    const screenOffset = createMemo(() => gameCoordsToScreen(props.image.location, windowSize(), viewCenterGameCoords(), viewScale()));

    const transparency = useSignal(overlayTransparencySignal);
    const canvasScaleModifier = createMemo(() => (props.smallPixels ? 1 / 3 : 1));

    createRenderEffect(() => {
        const canvas = canvasRef();
        if (!canvas) return;
        const imageData = props.imageData;
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.putImageData(imageData, 0, 0);
    });

    return (
        <canvas
            ref={setCanvasRef}
            class="tw-base tw-pointer-events-none tw-absolute tw-left-0 tw-top-0 tw-origin-top-left"
            style={{
                'image-rendering': 'pixelated',
                opacity: transparency() / 100,
                transform: `scale(${(viewScale() * canvasScaleModifier()).toString()})`,
                left: `${screenOffset().clientX.toString()}px`,
                top: `${screenOffset().clientY.toString()}px`,
            }}
        />
    );
}

const OverlayImageImg = (props: { image: OverlayImage; imageUrl: string }) => {
    const windowSize = useSignal(windowInnerSize);
    const topLeftGameCoords = useSignal(viewCenterSignal);
    const viewScale = useSignal(viewScaleSignal);
    const screenOffset = createMemo(() => gameCoordsToScreen(props.image.location, windowSize(), topLeftGameCoords(), viewScale()));
    const opacity1to100 = useSignal(overlayTransparencySignal);

    return (
        <img
            alt=""
            class="tw-base tw-pointer-events-none tw-absolute tw-left-0 tw-top-0 tw-origin-top-left"
            src={props.imageUrl}
            style={{
                'image-rendering': 'pixelated',
                opacity: opacity1to100() / 100,
                transform: `scale(${viewScale().toString()})`,
                left: `${screenOffset().clientX.toString()}px`,
                top: `${screenOffset().clientY.toString()}px`,
            }}
        />
    );
};

function useOverlayImageFileUrl(overlayImageId: Accessor<number>) {
    const imagesById = useSignal(overlayImagesById);
    const image = createMemo(() => imagesById()[overlayImageId()]);
    const fileUrl = createMemo(() => {
        const i = image();
        if (!i) return;
        return useImageFileUrl(() => i.imageFile)();
    });
    return fileUrl;
}

function OverlayImageRender(props: { imageId: number }) {
    const fileUrl = useOverlayImageFileUrl(() => props.imageId);
    const imageData = useOverlayImageImageData(() => props.imageId);
    const imagesById = useSignal(overlayImagesById);
    const image = createMemo(() => imagesById()[props.imageId]);

    return (
        <>
            <Show when={image()}>
                {(image) => (
                    <>
                        <Switch fallback={<Show when={fileUrl()}>{(fileUrl) => <OverlayImageImg image={image()} imageUrl={fileUrl()} />}</Show>}>
                            <Match when={imageData()}>{(imageData) => <OverlayImageCanvas image={image()} imageData={imageData()} />}</Match>
                        </Switch>
                    </>
                )}
            </Show>
        </>
    );
}

export function OverlayImages() {
    const imageIds = useSignal(overlayImagesIdsVisibleOnScreen);
    return <For each={[...imageIds()]}>{(imageId) => <OverlayImageRender imageId={imageId} />}</For>;
}
