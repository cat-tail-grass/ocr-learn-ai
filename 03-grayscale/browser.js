/** Shared algorithms, adapted only to native ImageData for Canvas display. Build: npm run build. */
const api = require('../shared/03-grayscale');
const native = img => new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
const wrap = fn => (...args) => native(fn(...args));
window.OCRLesson03 = {
    grayscaleWeighted: wrap(api.grayscaleWeighted),
    grayscaleAverage: wrap(api.grayscaleAverage),
    grayscaleMax: wrap(api.grayscaleMax),
    grayscaleMin: wrap(api.grayscaleMin),
    grayscaleSingleChannel: wrap(api.grayscaleSingleChannel),
    grayscaleLuminosity: wrap(api.grayscaleLuminosity),
    grayscaleLinearSrgb: wrap(api.grayscaleLinearSrgb),
    calculateHistogram: api.calculateHistogram,
    calculateHistogramStats: api.calculateHistogramStats,
    calculateStats: api.calculateHistogramStats,
};
