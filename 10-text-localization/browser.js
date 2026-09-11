// 修改shared或此文件后，在项目根目录运行：
// node 10-text-localization/build-browser.js
const algorithms = Object.assign({},
    require('../shared/10-text-localization'),
    require('../shared/03-grayscale'),
    require('../shared/04-binarization'),
    require('../shared/core/imageData'),
    require('../shared/core/pixelAccess'),
    require('../shared/07-deskewing'),
    require('../shared/09-connected-components')
);

function nativeResult(value) {
    if (value && value.data instanceof Uint8ClampedArray && Number.isInteger(value.width)) {
        return new ImageData(new Uint8ClampedArray(value.data), value.width, value.height);
    }
    if (Array.isArray(value)) return value.map(nativeResult);
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, nativeResult(item)]));
    }
    return value;
}

window.LessonAlgorithms = Object.fromEntries(Object.entries(algorithms).map(([name, fn]) =>
    [name, name === 'UnionFind' ? fn : (...args) => nativeResult(fn(...args))]
));
