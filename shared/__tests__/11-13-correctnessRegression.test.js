const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('../11-feature-extraction');
const T = require('../12-template-matching');
const K = require('../13-knn-classifier');
const { MockImageData } = require('../core');

function image(width, height, points = []) {
    const result = new MockImageData(width, height);
    result.data.fill(255);
    for (const [x, y] of points) {
        const i = (y * width + x) * 4;
        result.data[i] = result.data[i + 1] = result.data[i + 2] = 0;
    }
    return result;
}

describe('11: moments, raster limits, preprocessing and HOG', () => {
    test('large translations must not corrupt third central moments by cancellation', () => {
        const points = [[0, 0], [1, 0], [0, 1], [1, 2]];
        const a = F.calculateCentralMoments(image(3, 4, points));
        const b = F.calculateCentralMoments(image(99903, 4, points.map(([x, y]) => [x + 99900, y])));
        for (const name of ['mu20', 'mu02', 'mu11', 'mu30', 'mu03', 'mu21', 'mu12']) {
            expect(b[name]).toBeCloseTo(a[name], 10);
        }
        expect(b.mu30).toBe(0);
        expect(b.mu12).toBe(0.75);
    });

    test('three-pixel L agrees with hand moments and normalized Hu values', () => {
        const a = image(3, 3, [[0, 0], [1, 0], [0, 1]]);
        const m = F.calculateCentralMoments(a);
        expect(m.m00).toBe(3);
        expect(m.xBar).toBeCloseTo(1 / 3, 12);
        expect(m.mu20).toBeCloseTo(2 / 3, 12);
        expect(m.mu11).toBeCloseTo(-1 / 3, 12);
        const hu = F.calculateHuMoments(a);
        expect(hu[0]).toBeCloseTo(4 / 27, 12);
        expect(hu[1]).toBeCloseTo(4 / 729, 12);
    });

    test('Hu is invariant to grid-preserving rotation; reflection flips only h7', () => {
        const pts = [[1, 1], [2, 1], [1, 2], [2, 3]];
        const original = F.calculateHuMoments(image(6, 6, pts));
        const rotated = F.calculateHuMoments(image(6, 6, pts.map(([x, y]) => [5 - y, x])));
        const reflected = F.calculateHuMoments(image(6, 6, pts.map(([x, y]) => [5 - x, y])));
        expect(Math.abs(original[6])).toBeGreaterThan(1e-10);
        original.forEach((h, i) => {
            expect(rotated[i]).toBeCloseTo(h, 12);
            expect(reflected[i]).toBeCloseTo(i === 6 ? -h : h, 12);
        });
    });

    test('raster square scale change is not exact Hu invariance', () => {
        const square = n => image(n, n, Array.from({ length: n * n }, (_, i) => [i % n, Math.floor(i / n)]));
        expect(F.calculateHuMoments(square(4))[0]).toBeCloseTo(15 / 96, 12);
        expect(F.calculateHuMoments(square(8))[0]).toBeCloseTo(63 / 384, 12);
    });

    test('thin nonempty character must survive crop-and-center', () => {
        const thin = image(1, 100, Array.from({ length: 100 }, (_, y) => [0, y]));
        expect(F.extractStatisticalFeatures(F.cropAndCenter(thin, 28)).foregroundCount).toBe(24);
        expect(() => F.cropAndCenter(thin, 28, 0.5)).toThrow();
    });

    test('explicit zero std uses the documented constant-feature convention', () => {
        expect(F.normalizeFeatures([2, 2], 'zscore', { mean: 2, std: 0 })).toEqual([0, 0]);
    });

    test('HOG uses center differences, half-open hard bins, and magnitude votes', () => {
        const ramp = (dx, dy) => {
            const out = image(7, 7);
            for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
                const i = (y * 7 + x) * 4;
                out.data[i] = out.data[i + 1] = out.data[i + 2] = 30 + dx * x + dy * y;
            }
            return out;
        };
        const a = F.computeHOGCells(ramp(3, 1), { cellSize: 7, numBins: 9 });
        expect(a.histograms[0][0]).toBeCloseTo(25 * Math.sqrt(40), 4);
        expect(a.histograms[0].slice(1)).toEqual(Array(8).fill(0));
        const b = F.computeHOGCells(ramp(5, 2), { cellSize: 7, numBins: 9 });
        expect(b.histograms[0][0]).toBe(0);
        expect(b.histograms[0][1]).toBeCloseTo(25 * Math.sqrt(116), 4);
        const h = F.extractHOGFeatures(ramp(3, 1), { cellSize: 7, blockSize: 1 });
        expect(h[0]).toBeCloseTo(1, 9);
        expect(() => F.extractHOGFeatures(ramp(3, 1), { cellSize: 0 })).toThrow();
    });
});

describe('12: distances and scores', () => {
    test('constant NCC uses zero sentinel, never perfect correlation', () => {
        for (const [a, b] of [[[5, 5], [3, 3]], [[5, 5], [5, 5]], [[5, 5], [1, 2]]]) {
            expect(T.normalizedCrossCorrelation(a, b)).toBe(0);
            expect(T.calculateDistance(a, b, 'correlation')).toBe(1);
        }
        expect(T.normalizedCrossCorrelation([1, 2, 3], [5, 7, 9])).toBeCloseTo(1, 12);
    });

    test('softmax requires positive finite temperature and preserves distant relative scores', () => {
        const close = [{ label: 'A', distance: 0 }, { label: 'B', distance: 1 }];
        for (const temperature of [0, -1, Infinity, NaN]) {
            expect(() => T.calculateConfidence(close, { temperature })).toThrow();
        }
        const far = close.map(r => ({ ...r, distance: r.distance + 1000 }));
        expect(T.calculateConfidence(far)[0].confidence).toBeCloseTo(T.calculateConfidence(close)[0].confidence, 12);
        expect(T.calculateConfidence([{ label: 'A', distance: 1000 }])[0].confidence).toBe(1);
    });

    test('HOG feature choice must not silently return combined features', () => {
        const a = image(28, 28, [[5, 5], [7, 9], [6, 13]]);
        const template = T.createTemplate(a, 'A', { featureType: 'hog' });
        expect(template.features).toEqual(F.extractHOGFeatures(F.cropAndCenter(a, 28)));
        expect(template.features.length).toBe(324);
        expect(() => T.createTemplate(a, 'A', { featureType: 'typo' })).toThrow();
    });

    test('empty image is rejected before matching and empty evaluation stays finite', () => {
        const matcher = new T.TemplateMatcher();
        matcher.addTemplateFromImage(image(4, 4, [[1, 1]]), 'A');
        expect(matcher.recognizeFromImage(image(4, 4)).rejected).toBe(true);
        expect(T.evaluateMatcher(matcher, []).accuracy).toBe(0);
    });
});

describe('13: honest splitting and parameter boundaries', () => {
    test('split ratios 0 and 1 respect the declared endpoints; NaN is invalid', () => {
        const samples = [0, 1, 2, 3];
        expect(K.splitTrainTest(samples, { testRatio: 0 })).toEqual({ train: expect.arrayContaining(samples), test: [] });
        expect(K.splitTrainTest(samples, { testRatio: 1 })).toEqual({ train: [], test: expect.arrayContaining(samples) });
        expect(() => K.splitTrainTest(samples, { testRatio: NaN })).toThrow();
    });

    test('related augmented samples stay together with groupBy', () => {
        const samples = Array.from({ length: 12 }, (_, i) => ({ sourceId: `source-${i % 3}`, label: 'A' }));
        const { train, test } = K.splitTrainTest(samples, { testRatio: 1 / 3, groupBy: 'sourceId', seed: 42 });
        const groups = new Set(train.map(s => s.sourceId));
        expect(test.length).toBe(4);
        expect(test.every(s => !groups.has(s.sourceId))).toBe(true);
    });

    test('invalid K and empty validation cannot silently choose a model', () => {
        const classifier = new K.KNNClassifier({ normalizeMethod: 'none' }).fit([{ label: 'A', features: [0] }]);
        for (const k of [0, -1, 1.5, NaN]) expect(() => classifier.predict([0], { k })).toThrow();
        expect(() => classifier.tuneK([], [1])).toThrow();
    });

    test('vote tie uses mean distance; odd K can still tie in multiclass', () => {
        const result = K.voteByNeighbors([{ label: 'A', distance: 3 }, { label: 'B', distance: 1 }, { label: 'C', distance: 2 }]);
        expect(result.label).toBe('B');
        expect(result.confidence).toBeCloseTo(1 / 3, 12);
    });

    test('lower rejection threshold is stricter even when vote share is 100%', () => {
        const classifier = new K.KNNClassifier({ k: 1, normalizeMethod: 'none' }).fit([{ label: 'A', features: [0] }]);
        expect(classifier.predict([2], { rejectThreshold: 3 }).rejected).toBe(false);
        expect(classifier.predict([2], { rejectThreshold: 1 }).rejected).toBe(true);
        expect(classifier.predict([2]).confidence).toBe(1);
        expect(classifier.predictFromImage(image(28, 28)).rejected).toBe(true);
    });

    test('explicit confusion label order is retained and unknown labels are rejected', () => {
        const result = K.buildConfusionMatrix(['B', 'A'], ['A', 'A'], ['B', 'A']);
        expect(result.labels).toEqual(['B', 'A']);
        expect(result.matrix.B.A).toBe(1);
        expect(() => K.buildConfusionMatrix(['B'], ['X'], ['B', 'A'])).toThrow();
    });
});

// Execute each actual browser script in its own context, with only initialization skipped.
function browserLesson(chapter) {
    const root = path.resolve(__dirname, '../..');
    const filename = path.join(root, chapter, 'index.html');
    // HTML 新增公共导航后也会读取浏览器 URL/currentScript。这里补齐环境，
    // 仍执行所有真实脚本，下面的算法一致性断言保持原样。
    const document = {
        baseURI: `https://ocr.test/ocr/labs/${chapter}/index.html`,
        readyState: 'complete',
        currentScript: null,
        querySelectorAll: () => [],
        getElementById: () => ({ getContext: () => ({}) })
    };
    const context = vm.createContext({ ImageData: MockImageData, URL, document });
    for (const match of fs.readFileSync(filename, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        const src = /src="([^"]+)"/.exec(match[1]);
        document.currentScript = { src: src ? new URL(src[1], document.baseURI).href : '' };
        const code = src ? fs.readFileSync(path.resolve(path.dirname(filename), src[1]), 'utf8') : match[2].replace(/\binit\(\);\s*$/, '');
        vm.runInContext(code, context);
    }
    return context;
}

describe('11–13: actual HTML algorithm parity', () => {
    const input = image(28, 28, [[3, 5], [4, 5], [3, 6], [4, 7]]);
    test('11 browser statistical/Hu/combined features equal the Node module', () => {
        const page = browserLesson('11-feature-extraction');
        page.input = input;
        const result = vm.runInContext('extractAllFeatures(input)', page);
        expect(Array.from(result.combined)).toEqual(F.extractCombinedFeatures(input).all);
        expect(Array.from(result.hog)).toEqual(F.extractHOGFeatures(input));
    });
    test('12 browser uses the same crop, Hu, feature dimensions and correlation', () => {
        const page = browserLesson('12-template-matching');
        page.input = input;
        expect(Array.from(vm.runInContext('extractFeatures(input)', page))).toEqual(T.createTemplate(input, 'A').features);
        expect(vm.runInContext('calculateDistance([5,5],[1,2],"correlation")', page)).toBe(1);
    });
    test('13 browser uses the same feature pipeline and tie rule', () => {
        const page = browserLesson('13-knn-classifier');
        page.input = input;
        expect(Array.from(vm.runInContext('extractCombinedFeatures(input)', page))).toEqual(K.createKNNSample(input, 'A').features);
        expect(vm.runInContext('knnPredict([0], [{label:"A",features:[3]},{label:"B",features:[1]},{label:"C",features:[2]}], 3, "euclidean", false).label', page)).toBe('B');
    });
});
