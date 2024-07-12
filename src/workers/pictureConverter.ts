import colorConverter from '../colorConverter';

export const pictureConverter = {
    async isImageValidCors(url: string): Promise<boolean> {
        try {
            const response = await fetch(url);
        } catch (error) {
            // Likely failed due to cors.
            return false;
        }
        return true;
    },

    applySmallPixelsModifier(imageData: ImageData) {
        const smallPixelsMultiplier = 3;
        const smallPixelsImageData = new ImageData(imageData.width * smallPixelsMultiplier, imageData.height * smallPixelsMultiplier);
        for (let outY = 0; outY < imageData.height; outY++) {
            for (let outX = 0; outX < imageData.width; outX++) {
                // eslint-disable-next-line no-bitwise
                const outIdx = (imageData.width * outY + outX) << 2;

                const outR = imageData.data[outIdx + 0] ?? 0;
                const outG = imageData.data[outIdx + 1] ?? 0;
                const outB = imageData.data[outIdx + 2] ?? 0;
                const outA = imageData.data[outIdx + 3] ?? 0;

                const smallX = outX * smallPixelsMultiplier + Math.floor(smallPixelsMultiplier / 2);
                const smallY = outY * smallPixelsMultiplier + Math.floor(smallPixelsMultiplier / 2);
                // eslint-disable-next-line no-bitwise
                const smallIdx = (smallY * smallPixelsImageData.width + smallX) << 2;

                smallPixelsImageData.data[smallIdx + 0] = outR;
                smallPixelsImageData.data[smallIdx + 1] = outG;
                smallPixelsImageData.data[smallIdx + 2] = outB;
                smallPixelsImageData.data[smallIdx + 3] = outA;
            }
        }
        return smallPixelsImageData;
    },

    async applyModificationsToImageData(colorPalette: [number, number, number][], imageData: ImageData, modifierConvertColors: boolean, brightenBy: number) {
        return new Promise<ImageData>((resolve) => {
            const outImageData = new ImageData(imageData.width, imageData.height);
            outImageData.data.set(imageData.data);
            if (modifierConvertColors) {
                for (let y = 0; y < outImageData.height; y++) {
                    for (let x = 0; x < outImageData.width; x++) {
                        // eslint-disable-next-line no-bitwise
                        const idx = (outImageData.width * y + x) << 2;

                        const originalR = imageData.data[idx + 0] ?? 0;
                        const originalG = imageData.data[idx + 1] ?? 0;
                        const originalB = imageData.data[idx + 2] ?? 0;
                        const originalA = imageData.data[idx + 3] ?? 0;

                        const r = Math.min(originalR + brightenBy, 255);
                        const g = Math.min(originalG + brightenBy, 255);
                        const b = Math.min(originalB + brightenBy, 255);

                        const resultArr = colorConverter.getClosestColorFromPalette(colorPalette, 0, r, g, b);
                        if (!resultArr) {
                            // unknown color...
                        } else {
                            const [convertedR, convertedG, convertedB] = resultArr;

                            outImageData.data[idx + 0] = convertedR;
                            outImageData.data[idx + 1] = convertedG;
                            outImageData.data[idx + 2] = convertedB;
                            // Trimming alpha if lower than threshold.
                            // Not sure if I should do this. But here we go. Results will be closer to actual canvas. Without transparency.
                            outImageData.data[idx + 3] = originalA > 30 ? 255 : 0;
                        }
                    }
                }
            }
            resolve(outImageData);
        });
    },
};
