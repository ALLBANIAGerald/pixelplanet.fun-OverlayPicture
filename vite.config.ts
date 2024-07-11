import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import solidPlugin from 'vite-plugin-solid';

import pkg from './package.json';

// https://vitejs.dev/config/
export default defineConfig((configEnv) => ({
    plugins: [
        solidPlugin(),
        monkey({
            entry: 'src/index.tsx',
            userscript: {
                name: pkg.displayName,
                icon: 'https://vitejs.dev/logo.svg',
                namespace: 'https://github.com/Woyken/pixelplanet.fun-OverlayPicture',
                version: pkg.version,
                description: pkg.description,
                author: pkg.author,
                match: ['https://pixelplanet.fun/*', 'https://fuckyouarkeros.fun/*', 'https://github.com/Woyken/pixelplanet.fun-OverlayPicture/*'],
                downloadURL: 'https://woyken.github.io/pixelplanet.fun-OverlayPicture/pixelPlanetOverlay-loader.user.js',
            },
        }),
    ],
}));
