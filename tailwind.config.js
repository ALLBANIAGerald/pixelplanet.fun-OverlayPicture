// @ts-check
import { scopedPreflightStyles, isolateInsideOfContainer } from 'tailwindcss-scoped-preflight';
import daisyui from 'daisyui';
/** @type {(import('tailwindcss').Config & {daisyui?: import('daisyui').Config})} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    prefix: 'tw-',
    theme: {
        extend: {},
    },
    plugins: [
        daisyui,
        scopedPreflightStyles({
            isolationStrategy: isolateInsideOfContainer('.tw-base'),
        }),
    ],
};
