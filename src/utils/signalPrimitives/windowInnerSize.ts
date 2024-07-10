import { Signal } from 'signal-polyfill';

const handleWindowResize = () => windowInnerSize.set({ width: window.innerWidth, height: window.innerHeight });
export const windowInnerSize = new Signal.State(
    { width: window.innerWidth, height: window.innerHeight },
    {
        [Signal.subtle.watched]: () => {
            queueMicrotask(() => {
                handleWindowResize();
            });
            window.addEventListener('resize', handleWindowResize);
        },
        [Signal.subtle.unwatched]: () => {
            window.removeEventListener('resize', handleWindowResize);
        },
    }
);
