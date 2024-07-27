import { useSignal } from '../../store/useSignal';
import thumbnail from '../../assets/thumbnail-small.png';
import { from, JSX } from 'solid-js';
import { isTemplateEnabledObs } from '../../utils/getPageReduxStore';

export function OverlayThumbnailImageButton(props: JSX.HTMLAttributes<HTMLInputElement>) {
    const isOverlayEnabled = from(isTemplateEnabledObs);
    return <input {...props} type="image" classList={{ 'tw-saturate-0': !isOverlayEnabled() }} src={thumbnail} />;
}

export function OverlayThumbnailImage(props: JSX.ImgHTMLAttributes<HTMLImageElement>) {
    const isOverlayEnabled = from(isTemplateEnabledObs);
    return <img {...props} classList={{ 'tw-saturate-0': !isOverlayEnabled() }} src={thumbnail} />;
}
