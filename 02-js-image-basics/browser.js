/** Shared algorithms, adapted only to native ImageData for Canvas display. Build: npm run build. */
const core = require('../shared/core');
const native = img => new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
const wrap = fn => (...args) => native(fn(...args));
window.OCRLesson02 = {
    cloneImageData: wrap(core.cloneImageData),
    getPixel: core.getPixel,
    setPixel: core.setPixel,
};
