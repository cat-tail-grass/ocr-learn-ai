/** Shared algorithms, adapted only to native ImageData for Canvas display. Build: npm run build. */
const api = require('../shared/05-denoising');
const gray = require('../shared/03-grayscale');
const core = require('../shared/core');
const native = img => new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
const wrap = fn => (...args) => native(fn(...args));
window.OCRLesson05 = {
    convolve: wrap(api.convolve),
    correlate: wrap(api.correlate),
    meanFilter: wrap(api.meanFilter),
    gaussianFilter: wrap(api.gaussianFilter),
    medianFilter: wrap(api.medianFilter),
    addGaussianNoise: wrap(api.addGaussianNoise),
    addSaltPepperNoise: wrap(api.addSaltPepperNoise),
    createMeanKernel: api.createMeanKernel,
    createGaussianKernel: api.createGaussianKernel,
    calculatePSNR: api.calculatePSNR,
    grayscaleImage: wrap(gray.grayscaleWeighted),
    cloneImageData: wrap(core.cloneImageData),
    createSeededRandom: core.createSeededRandom,
    clamp: core.clamp,
};
