import { useSignal } from '../../store/useSignal';
import { selectPageStateCanvasPalette } from '../../utils/getPageReduxStore';
import { viewCenterSignal, viewScaleSignal } from '../../store/slices/gameSlice';
import { isShowSmallPixelsActiveSignal, OverlayImage, overlayImagesById, overlayTransparencySignal, visibleOnScreenOverlayImages } from '../../store/slices/overlaySlice';
import { Accessor, createEffect, createMemo, createRenderEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { gameCoordsToScreen } from '../../utils/coordConversion';
import { windowInnerSize } from '../../utils/signalPrimitives/windowInnerSize';
import { createStore } from 'solid-js/store';
import { GM_xmlhttpRequest } from 'vite-plugin-monkey/dist/client';
import { pictureConverterApi } from '../../pictureConversionApi';

async function loadUrlToImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
            resolve(img);
        };
        img.onerror = () => {
            reject(new Error('Image load error'));
        };
    });
}

function usePromise<T>(fn: () => Promise<T>) {
    const [result, setResult] = createStore<{ state: 'loading' } | { state: 'ready'; result: T } | { state: 'error'; error: unknown }>({ state: 'loading' });

    createEffect(() => {
        setResult({
            state: 'loading',
        });
        fn()
            .then((r) => {
                setResult({
                    state: 'ready',
                    result: r,
                });
            })
            .catch((e: unknown) => {
                setResult({ state: 'error', error: e });
            });
    });
    return result;
}

// If this doesn't work we can use FileReader api to load image as readAsDataURL
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

function useLoadImageElement(imageFile: Accessor<OverlayImage['imageFile']>) {
    const fileUrl = useImageFileUrl(imageFile);
    // const fileDataUrlPromise = createMemo(() => readFileAsDataUrl(imageFile.type === 'file' ? imageFile.file : undefined));
    // const fileDataUrl = usePromise(fileDataUrlPromise);
    const loadedImgPromise = createMemo(async () => loadUrlToImage(fileUrl()));
    const loadedImg = usePromise(loadedImgPromise);
    const imgLoadFallbackPromise = createMemo(async () => {
        if (loadedImg.state !== 'error') return;
        const imgf = imageFile();
        if (imgf.type !== 'url') return;
        return new Promise<Blob>((resolve, reject) => {
            const reqAbort = GM_xmlhttpRequest({
                url: imgf.url,
                responseType: 'blob',
                onload: (event) => {
                    resolve(event.response);
                },
                onerror: (e) => {
                    reject(new Error(e.error));
                },
            });
            onCleanup(() => {
                reqAbort.abort();
            });
        });
    });
    const imgLoadFallbackUrl = usePromise(imgLoadFallbackPromise);
    const imgFallbackUrl = createMemo(() => {
        const url = imgLoadFallbackUrl.state === 'ready' && imgLoadFallbackUrl.result ? URL.createObjectURL(imgLoadFallbackUrl.result) : undefined;
        onCleanup(() => {
            if (url) URL.revokeObjectURL(url);
        });
        return url;
    });
    const loadedImgFallbackPromise = createMemo(async () => {
        const url = imgFallbackUrl();
        if (!url) return;
        return loadUrlToImage(url);
    });
    const loadedImgFallback = usePromise(loadedImgFallbackPromise);
    const loadingState = createMemo<{ state: 'loading' } | { state: 'ready'; result: HTMLImageElement } | { state: 'error'; error: unknown }>(() => {
        if (loadedImg.state === 'loading') {
            return {
                state: 'loading',
            };
        }
        if (loadedImg.state === 'ready') {
            return {
                state: 'ready',
                result: loadedImg.result,
            };
        }
        if (loadedImgFallback.state === 'loading') {
            return {
                state: 'loading',
            };
        }
        if (loadedImgFallback.state === 'ready') {
            if (loadedImgFallback.result === undefined) {
                return {
                    state: 'error',
                    error: new Error('Failed to load image'),
                };
            }
            return {
                state: 'ready',
                result: loadedImgFallback.result,
            };
        }
        return {
            state: 'error',
            error: new Error('Failed to load image'),
        };
    });
    return loadingState;
}

function useProcessImageDataModifications(
    palette: Accessor<[number, number, number][]>,
    inputImageData: Accessor<ImageData>,
    modifierShouldConvertColors: Accessor<boolean>,
    modifierImageBrightness: Accessor<number>
) {
    const abortController = new AbortController();
    const outImageDataPromise = createMemo(
        () =>
            new Promise<ImageData>((resolve, reject) => {
                abortController.signal.onabort = () => {
                    reject(new Error('aborted'));
                };
                pictureConverterApi
                    .applyModificationsToImageData(palette(), inputImageData(), modifierShouldConvertColors(), modifierImageBrightness())
                    .then((imageData) => {
                        resolve(imageData);
                    })
                    .catch((error: unknown) => {
                        reject(new Error(`Failed to applyModificationsToImageData ${JSON.stringify(error)}`));
                    });
            })
    );
    onCleanup(() => {
        abortController.abort('dispose');
    });
    return usePromise(outImageDataPromise);
}

function useProcessImageDataUseSmallPixels(inputImageData: Accessor<ImageData>) {
    const abortController = new AbortController();
    const outImageDataPromise = createMemo(
        () =>
            new Promise<ImageData>((resolve, reject) => {
                abortController.signal.onabort = () => {
                    reject(new Error('aborted'));
                };
                pictureConverterApi
                    .applySmallPixelsModifier(inputImageData())
                    .then((imageData) => {
                        resolve(imageData);
                    })
                    .catch((error: unknown) => {
                        reject(new Error(`Failed to applySmallPixelsModifier ${JSON.stringify(error)}`));
                    });
            })
    );
    onCleanup(() => {
        abortController.abort('dispose');
    });
    return usePromise(outImageDataPromise);
}

function useProcessCanvasData(inputImageData: Accessor<ImageData | undefined>, modifierShouldConvertColors: Accessor<boolean>, modifierImageBrightness: Accessor<number>) {
    const isShowSmallPixelsActive = useSignal(isShowSmallPixelsActiveSignal);
    const palette = useSignal(selectPageStateCanvasPalette);
    const processedRegularData = createMemo(() => {
        const img = inputImageData();
        return img ? useProcessImageDataModifications(palette, () => img, modifierShouldConvertColors, modifierImageBrightness) : undefined;
    });
    const processedSmallPixelsData = createMemo(() => {
        if (!isShowSmallPixelsActive()) return;
        const processedData = processedRegularData();
        if (processedData && processedData.state === 'ready') return useProcessImageDataUseSmallPixels(() => processedData.result);
        const img = inputImageData();
        return img ? useProcessImageDataUseSmallPixels(() => img) : undefined;
    });
    return {
        modifiers: processedRegularData,
        small: processedSmallPixelsData,
    };
}

const OverlayImageCanvas = (props: { image: OverlayImage; loadedImageElement: HTMLImageElement }) => {
    const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
    const windowSize = useSignal(windowInnerSize);
    const viewCenterGameCoords = useSignal(viewCenterSignal);
    const viewScale = useSignal(viewScaleSignal);
    const screenOffset = createMemo(() => gameCoordsToScreen(props.image.location, windowSize(), viewCenterGameCoords(), viewScale()));

    const transparency = useSignal(overlayTransparencySignal);
    const modifierSmallPixels = useSignal(isShowSmallPixelsActiveSignal);
    const canvasScaleModifier = createMemo(() => (modifierSmallPixels() ? 1 / 3 : 1));
    const [imageData, setImageData] = createSignal<ImageData>();

    const processedCanvasData = useProcessCanvasData(
        imageData,
        () => props.image.modifications.convertColors.enabled,
        () => props.image.modifications.overrideBrightness.brightness
    );

    const smallPixelsData = createMemo(() => {
        if (!modifierSmallPixels()) return;
        const small = processedCanvasData.small();
        if (small?.state !== 'ready') return;
        return small.result;
    });

    const modifiersData = createMemo(() => {
        const modifiers = processedCanvasData.modifiers();
        if (modifiers?.state !== 'ready') return;
        return modifiers.result;
    });

    const renderData = createMemo(() => {
        if (viewScale() > 5) {
            const smallPixelsD = smallPixelsData();
            if (smallPixelsD) {
                return {
                    type: 'smallPixels',
                    imageData: smallPixelsD,
                } as const;
            }
        }
        const mData = modifiersData();
        if (mData)
            return {
                type: 'modified',
                imageData: mData,
            } as const;
        return {
            type: 'regular',
        } as const;
    });

    createRenderEffect(() => {
        const canvas = canvasRef();
        if (!canvas) return;
        const loadedImageElement = props.loadedImageElement;
        canvas.width = loadedImageElement.width;
        canvas.height = loadedImageElement.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(loadedImageElement, 0, 0);
        setImageData(ctx.getImageData(0, 0, loadedImageElement.width, loadedImageElement.height));
    });

    return (
        <>
            <Show when={renderData().type === 'regular'}>
                <canvas
                    ref={setCanvasRef}
                    class={'pointer-events-none absolute left-0 top-0 origin-top-left'}
                    style={{
                        'image-rendering': 'pixelated',
                        opacity: transparency() / 100,
                        transform: `scale(${(viewScale() * canvasScaleModifier()).toString()})`,
                        left: screenOffset().clientX.toString(),
                        top: screenOffset().clientY.toString(),
                    }}
                />
            </Show>
            <Show
                when={(() => {
                    const r = renderData();
                    return r.type === 'modified' || r.type === 'smallPixels' ? r : false;
                })()}
            >
                {(data) => <OverlayImageCanvasFromImageData image={props.image} imageData={data().imageData} smallPixels={data().type === 'smallPixels'} />}
            </Show>
        </>
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
            class="pointer-events-none absolute left-0 top-0 origin-top-left"
            style={{
                'image-rendering': 'pixelated',
                opacity: transparency() / 100,
                transform: `scale(${(viewScale() * canvasScaleModifier()).toString()})`,
                left: screenOffset().clientX.toString(),
                top: screenOffset().clientY.toString(),
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
            class="pointer-events-none absolute left-0 top-0 origin-top-left"
            src={props.imageUrl}
            style={{
                'image-rendering': 'pixelated',
                opacity: opacity1to100() / 100,
                transform: `scale(${viewScale.toString()})`,
                left: screenOffset().clientX.toString(),
                top: screenOffset().clientY.toString(),
            }}
        />
    );
};

function OverlayImageRender(props: { imageId: number }) {
    const imagesById = useSignal(overlayImagesById);
    const image = createMemo(() => imagesById()[props.imageId]);
    const loadedImageElementNested = createMemo(() => {
        const img = image();
        if (img) return useLoadImageElement(() => img.imageFile);
    });
    const fileUrlNested = createMemo(() => {
        const img = image();
        if (img) return useImageFileUrl(() => img.imageFile);
    });
    const fileUrl = createMemo(() => fileUrlNested()?.());
    const loadedImageElement = createMemo(() => loadedImageElementNested()?.());

    const renderData = createMemo<
        | { type: 'empty' }
        | { type: 'canvas'; data: { image: OverlayImage; imgEl: HTMLImageElement } }
        | { type: 'img'; data: { image: OverlayImage; url: string } }
        | {
              type: 'error';
              data: {
                  error: string;
              };
          }
    >(() => {
        const imgData = image();
        if (!imgData)
            return {
                type: 'empty',
            } as const;
        const loadedImgEl = loadedImageElement();
        if (loadedImgEl?.state === 'ready')
            return {
                type: 'canvas',
                data: {
                    image: imgData,
                    imgEl: loadedImgEl.result,
                },
            } as const;
        const fUrl = fileUrl();
        if (fUrl)
            return {
                type: 'img',
                data: {
                    url: fUrl,
                    image: imgData,
                },
            } as const;
        if (imgData.imageFile.type === 'url')
            return {
                type: 'img',
                data: {
                    url: imgData.imageFile.url,
                    image: imgData,
                },
            } as const;
        return {
            type: 'error',
            data: {
                error: 'Unknown image state',
            } as const,
        };
    });

    return (
        <>
            <Show
                when={(() => {
                    const d = renderData();
                    return d.type === 'canvas' ? d : false;
                })()}
            >
                {(renderData) => <OverlayImageCanvas image={renderData().data.image} loadedImageElement={renderData().data.imgEl} />}
            </Show>
            <Show
                when={(() => {
                    const d = renderData();
                    return d.type === 'img' ? d : false;
                })()}
            >
                {(renderData) => <OverlayImageImg image={renderData().data.image} imageUrl={renderData().data.url} />}
            </Show>
            <Show
                when={(() => {
                    const d = renderData();
                    return d.type === 'error' ? d : false;
                })()}
            >
                {(renderData) => <div>Failed load overlay image! {renderData().data.error}</div>}
            </Show>
        </>
    );
}

export function OverlayImages() {
    const images = useSignal(visibleOnScreenOverlayImages);
    return <For each={images()}>{(image) => <OverlayImageRender imageId={image.id} />}</For>;
}
