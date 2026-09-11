/** Independent numerical counterexamples for the 2026-09-11 review.
 * Set OCR_REVIEW_SOURCE_ROOT to the frozen source snapshot to verify old failures.
 */
const path = require('node:path');
const root = process.env.OCR_REVIEW_SOURCE_ROOT || path.resolve(__dirname, '../..');
const core = require(path.join(root, 'shared/core'));
const gray = require(path.join(root, 'shared/03-grayscale'));
const binary = require(path.join(root, 'shared/04-binarization'));
const denoise = require(path.join(root, 'shared/05-denoising'));

function image(values, width = values.length, alpha = 255) {
    const img = core.createImageData(width, values.length / width);
    values.forEach((v, i) => core.setPixel(img, i % width, Math.floor(i / width), v, v, v, alpha));
    return img;
}
const reds = img => Array.from(img.data).filter((_, i) => i % 4 === 0);

describe('01–03 pixel and grayscale definitions', () => {
    test('fractional coordinates must not read/write another channel', () => {
        const img = image([10, 20]);
        const before = Array.from(img.data);
        expect(core.getPixel(img, 0.25, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
        core.setPixel(img, 0.25, 0, 100, 100, 100);
        expect(Array.from(img.data)).toEqual(before);
    });
    test('gray example is 159 and alpha is not a brightness channel', () => {
        const img = core.createImageData(1, 1, 255, 128, 64, 128);
        expect(Array.from(gray.grayscaleWeighted(img).data)).toEqual([159, 159, 159, 128]);
    });
    test('even sample median averages the two central observations', () => {
        const histogram = gray.calculateHistogram(image([0, 255]));
        const stats = gray.calculateHistogramStats(histogram, 2);
        expect(stats.median).toBe(127.5);
        expect(stats.mean).toBe(127.5);
        expect(stats.std).toBe(127.5);
    });
    test('unknown channel cannot silently leave a color image unchanged', () => {
        expect(() => gray.grayscaleSingleChannel(image([20]), 'alpha')).toThrow();
    });
});

describe('04 Otsu and local threshold counterexamples', () => {
    test('class boundary includes t, including t=0', () => {
        expect(reds(binary.binarizeOtsu(image([0, 255])).imageData)).toEqual([0, 255]);
        expect(reds(binary.binarizeOtsu(image([30, 40, 50, 180, 190, 200])).imageData))
            .toEqual([0, 0, 0, 255, 255, 255]);
    });
    test('between-class variance is probability weighted and scale invariant', () => {
        const h = gray.calculateHistogram(image([30, 40, 50, 180, 190, 200]));
        expect(binary.calculateOtsuThreshold(h).variance).toBeCloseTo(5625, 10);
        expect(binary.calculateOtsuThreshold(h.map(v => v * 100)).variance).toBeCloseTo(5625, 10);
        expect(binary.calculateOtsuThreshold(h).threshold).toBe(50);
    });
    test('adaptive equality is white and edge neighborhoods are cropped', () => {
        expect(reds(binary.binarizeAdaptive(image([0, 100, 100]), 3, 0))).toEqual([0, 255, 255]);
        expect(reds(binary.binarizeAdaptive(image([128]), 3, 0))).toEqual([255]);
    });
    test('local threshold preserves alpha just as fixed threshold does', () => {
        const img = image([80], 1, 64);
        expect(binary.binarizeAdaptive(img, 3, 0).data[3]).toBe(64);
    });
    test('invalid local neighborhoods must not silently change size', () => {
        for (const size of [0, -3, 2, 2.5, NaN]) {
            expect(() => binary.binarizeAdaptive(image([80]), size)).toThrow();
        }
    });
});

describe('05 filters, noise and measurement', () => {
    test('asymmetric kernel distinguishes convolution from correlation', () => {
        const img = image([10, 20, 40]);
        const kernel = [[0, 0, 0], [1, 0, 0], [0, 0, 0]];
        expect(reds(denoise.convolve(img, kernel))).toEqual([20, 40, 40]);
    });
    test('mean rounds 1085/9 to 121 and median is 105', () => {
        const img = image([100, 120, 110, 90, 255, 130, 80, 95, 105], 3);
        expect(denoise.meanFilter(img, 3).data[16]).toBe(121);
        expect(denoise.medianFilter(img, 3).data[16]).toBe(105);
    });
    test('linear smoothers preserve a constant with replicate boundaries and alpha', () => {
        const img = image([80], 1, 64);
        for (const fn of [denoise.meanFilter, denoise.gaussianFilter, denoise.medianFilter]) {
            expect(Array.from(fn(img, 3).data)).toEqual([80, 80, 80, 64]);
        }
    });
    test('zero Gaussian noise is identity even on RGB and the RNG endpoint zero', () => {
        const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
        try {
            const img = core.createImageData(1, 1, 30, 100, 200, 64);
            expect(Array.from(denoise.addGaussianNoise(img, 0).data)).toEqual(Array.from(img.data));
        } finally { spy.mockRestore(); }
    });
    test('density one visits every pixel even when the RNG repeats', () => {
        const spy = jest.spyOn(Math, 'random').mockReturnValue(0.75);
        try {
            expect(reds(denoise.addSaltPepperNoise(image(Array(10).fill(128)), 1)))
                .toEqual(Array(10).fill(255));
        } finally { spy.mockRestore(); }
    });
    test('zero sigma kernel cannot produce a silently black image', () => {
        expect(() => denoise.createGaussianKernel(3, 0)).toThrow();
    });
});
