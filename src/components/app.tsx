import { useSignal } from '../store/useSignal';
import { isOverlayEnabledSignal } from '../store/slices/overlaySlice';
import { OverlayImages } from './overlayImage/overlayImage';
import { createEffect, Show } from 'solid-js';
import { ConfigurationModal } from './configurationModal/configurationModal';

// function useWebSocketEvents() {
//     const dispatch = useAppDispatch();
//     createEffect(() => webSocketEvents.on('pixelUpdate', (data) => dispatch(chunkDataSlice.actions.setPixel(data))), [dispatch]);
// }

function useGlobalKeyShortcuts() {
    const isOverlayEnabled = useSignal(isOverlayEnabledSignal);
    const handleToggleOverlay = () => {
        isOverlayEnabledSignal[1](!isOverlayEnabled);
    };
    createEffect(() => {
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

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    });
}

const App = () => {
    useGlobalKeyShortcuts();
    // useWebSocketEvents();

    const isOverlayEnabled = useSignal(isOverlayEnabledSignal);

    // const [isPageLoaded, setIsPageLoaded] = createSignal(false);

    // When palette loads consider page loaded.
    // Sometimes userscript might finish loading sooner than page
    // const palette = useSignal(selectPageStateCanvasPalette);
    // createEffect(() => {
    //     if (!palette.length) return;
    //     setIsPageLoaded(true);
    // });

    return (
        <div class="tw-base">
            {/* <ProviderPageStateMapper> */}
            <Show when={isOverlayEnabled()}>
                <OverlayImages />
            </Show>
            <ConfigurationModal />
            {/* </ProviderPageStateMapper> */}
        </div>
    );
};

export default App;
