import { isOverlayEnabledSignal } from '../../store/slices/overlaySlice';
import { useSignal } from '../../store/useSignal';
import thumbnail from '../../assets/thumbnail-small.png';
import { JSX } from 'solid-js';

export function OverlayThumbnailImageButton(props: JSX.HTMLAttributes<HTMLInputElement>) {
    const isOverlayEnabled = useSignal(isOverlayEnabledSignal);
    return <input {...props} type="image" classList={{ 'tw-saturate-0': !isOverlayEnabled() }} src={thumbnail} />;
}

export function OverlayThumbnailImage(props: JSX.ImgHTMLAttributes<HTMLImageElement>) {
    const isOverlayEnabled = useSignal(isOverlayEnabledSignal);
    return <img {...props} classList={{ 'tw-saturate-0': !isOverlayEnabled() }} src={thumbnail} />;
}
