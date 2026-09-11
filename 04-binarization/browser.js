/** Shared algorithms, adapted only to native ImageData for Canvas display. Build: npm run build. */
const api = require('../shared/04-binarization');
const gray = require('../shared/03-grayscale');
const native = img => new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
const wrap = fn => (...args) => native(fn(...args));
window.OCRLesson04 = {
    binarizeFixed: wrap(api.binarizeFixed),
    binarizeAdaptive: wrap(api.binarizeAdaptive),
    calculateOtsuThreshold: api.calculateOtsuThreshold,
    grayscaleWeighted: wrap(gray.grayscaleWeighted),
    calculateHistogram: gray.calculateHistogram,
    binarizeOtsu: image => {
        const result = api.binarizeOtsu(image);
        return { ...result, imageData: native(result.imageData) };
    },
};
