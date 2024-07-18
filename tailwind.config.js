// @ts-check
import { scopedPreflightStyles, isolateInsideOfContainer } from 'tailwindcss-scoped-preflight';
import tailwindContainerQueries from '@tailwindcss/container-queries';
import daisyui from 'daisyui';
/** @type {(import('tailwindcss').Config & {daisyui?: import('daisyui').Config})} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    prefix: 'tw-',
    theme: {
        extend: {
            containers: {
                '2xs': '16rem',
                '3xs': '12rem',
                '4xs': '8rem',
                '5xs': '6rem',
                '6xs': '2rem',
            },
        },
    },
    plugins: [
        /** @type {import('tailwindcss/types/config').PluginCreator} */
        ({ addVariant }) => {
            addVariant('starting', '@starting-style');
        },
        tailwindContainerQueries,
        daisyui,
        scopedPreflightStyles({
            isolationStrategy: isolateInsideOfContainer('.tw-base'),
        }),
    ],
};
