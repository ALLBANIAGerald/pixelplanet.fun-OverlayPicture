import colorConverter from '../colorConverter';
import { delay } from '../utils/promiseUtils';

const cancellationIds = new Set<number>();

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

    cancelProcessById(id: number) {
        cancellationIds.add(id);
    },

    async applyModificationsToImageData(id: number, colorPalette: [number, number, number][], imageData: ImageData, brightenBy: number, partialUpdate: (imageData: ImageData) => void) {
        cancellationIds.delete(id);
        const outImageData = new ImageData(imageData.data, imageData.width, imageData.height);
        outImageData.data.set(imageData.data);
        for (let y = 0; y < outImageData.height; y++) {
            for (let x = 0; x < outImageData.width; x++) {
                const idxNum = outImageData.width * y + x;
                if (idxNum % 500 === 0) {
                    await delay(0);
                    if (cancellationIds.has(id)) {
                        cancellationIds.delete(id);
                        throw new Error('Process cancelled');
                    }
                }
                if (idxNum % 60_000 === 0) {
                    partialUpdate(outImageData);
                }
                const idx = idxNum << 2;

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
        return outImageData;
    },
};
