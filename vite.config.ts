import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import solidPlugin from 'vite-plugin-solid';
// import devtools from 'solid-devtools/vite';
import pkg from './package.json';
import { readFileSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig((configEnv) => ({
    plugins: [
        // devtools(),
        solidPlugin(),
        monkey({
            entry: 'src/index.tsx',
            userscript: {
                name: pkg.displayName,
                icon: `data:image/png;base64,${readFileSync('./src/assets/thumbnail-small.png', 'base64')}`,
                'inject-into': 'page',
                namespace: 'https://github.com/Woyken/pixelplanet.fun-OverlayPicture',
                version: pkg.version,
                description: pkg.description,
                author: pkg.author,
                match: ['https://pixelplanet.fun/*', 'https://fuckyouarkeros.fun/*', 'https://github.com/Woyken/pixelplanet.fun-OverlayPicture/*'],
                connect: '*',
                downloadURL: 'https://woyken.github.io/pixelplanet.fun-OverlayPicture/pixelPlanetOverlay-loader.user.js',
                updateURL: 'https://woyken.github.io/pixelplanet.fun-OverlayPicture/pixelPlanetOverlay-loader.user.js',
            },
        }),
    ],
    build: {
        sourcemap: true,
    },
}));
