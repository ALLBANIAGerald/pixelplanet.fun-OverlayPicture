import { createSignalState } from './createSignal';

export const windowInnerSize = createSignalState({ width: window.innerWidth, height: window.innerHeight }, (s) => {
    const handleWindowResize = () => {
        s.set({ width: window.innerWidth, height: window.innerHeight });
    };
    queueMicrotask(() => {
        handleWindowResize();
    });
    window.addEventListener('resize', handleWindowResize);
    return () => {
        window.removeEventListener('resize', handleWindowResize);
    };
});
