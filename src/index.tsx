/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import { executeAllHooks } from './gameInjection/pageStoreHooks';
import AppProvidersWrapper from './components/appProvidersWrapper';

function init(): void {
    executeAllHooks();

    const rootNode = document.createElement('div');
    rootNode.id = 'PictureOverlay_RootNode';
    document.body.prepend(rootNode);
    render(() => <AppProvidersWrapper />, rootNode);
}

if (document.readyState !== 'complete') {
    document.addEventListener('readystatechange', function readyStateChange() {
        if (document.readyState === 'complete') {
            document.removeEventListener('readystatechange', readyStateChange);
            init();
        }
    });
} else {
    init();
}
