/** 第13章可复现合成实验。来源是程序化造字配置，不是真实书写者/MNIST。 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../core'), require('./index'));
    } else {
        root.OCRKNNDemo = factory({ createImageData: (width, height) => new ImageData(width, height) }, root.OCRKNN);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function ({ createImageData }, { splitTrainTest }) {
function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function createBlankImage(size = 28) {
    const imageData = createImageData(size, size);

    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255;
        imageData.data[i + 1] = 255;
        imageData.data[i + 2] = 255;
        imageData.data[i + 3] = 255;
    }

    return imageData;
}

/**
 * 函数名称：setBlackPixel
 * 功能说明：设置黑色像素（带边界检查）
 */
function setBlackPixel(imageData, x, y) {
    if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) {
        return;
    }

    const idx = (y * imageData.width + x) * 4;
    imageData.data[idx] = 0;
    imageData.data[idx + 1] = 0;
    imageData.data[idx + 2] = 0;
}

/**
 * 函数名称：createDigitImage
 * 功能说明：生成简化数字图像（0-9）
 *
 * 原理解释：
 * - 用几何线段构造“可区分”的数字形状
 * - 用于构造可控的教学数据集
 */
function createDigitImage(digit, size = 28) {
    const imageData = createBlankImage(size);
    const center = Math.floor(size / 2);

    switch (digit) {
        case 0:
            for (let angle = 0; angle < 360; angle += 5) {
                const rad = angle * Math.PI / 180;
                const x = Math.round(center + 8 * Math.cos(rad));
                const y = Math.round(center + 10 * Math.sin(rad));
                setBlackPixel(imageData, x, y);
                setBlackPixel(imageData, x + 1, y);
            }
            break;

        case 1:
            for (let y = 4; y < 24; y++) {
                setBlackPixel(imageData, center, y);
                setBlackPixel(imageData, center + 1, y);
            }
            setBlackPixel(imageData, center - 2, 6);
            setBlackPixel(imageData, center - 1, 5);
            break;

        case 2:
            for (let x = center - 6; x <= center + 6; x++) {
                setBlackPixel(imageData, x, 4);
                setBlackPixel(imageData, x, 13);
                setBlackPixel(imageData, x, 23);
            }
            for (let y = 4; y < 14; y++) setBlackPixel(imageData, center + 6, y);
            for (let y = 13; y < 24; y++) setBlackPixel(imageData, center - 6, y);
            break;

        case 3:
            for (let x = center - 5; x <= center + 5; x++) {
                setBlackPixel(imageData, x, 4);
                setBlackPixel(imageData, x, 13);
                setBlackPixel(imageData, x, 23);
            }
            for (let y = 4; y < 24; y++) setBlackPixel(imageData, center + 5, y);
            break;

        case 4:
            for (let y = 4; y < 15; y++) setBlackPixel(imageData, center - 5, y);
            for (let x = center - 5; x <= center + 5; x++) setBlackPixel(imageData, x, 14);
            for (let y = 4; y < 24; y++) setBlackPixel(imageData, center + 3, y);
            break;

        case 5:
            for (let x = center - 6; x <= center + 6; x++) {
                setBlackPixel(imageData, x, 4);
                setBlackPixel(imageData, x, 13);
                setBlackPixel(imageData, x, 23);
            }
            for (let y = 4; y < 14; y++) setBlackPixel(imageData, center - 6, y);
            for (let y = 13; y < 24; y++) setBlackPixel(imageData, center + 6, y);
            break;

        case 6:
            for (let y = 4; y < 24; y++) setBlackPixel(imageData, center - 6, y);
            for (let x = center - 6; x <= center + 6; x++) {
                setBlackPixel(imageData, x, 4);
                setBlackPixel(imageData, x, 13);
                setBlackPixel(imageData, x, 23);
            }
            for (let y = 13; y < 24; y++) setBlackPixel(imageData, center + 6, y);
            break;

        case 7:
            for (let x = 6; x <= 21; x++) {
                setBlackPixel(imageData, x, 4);
                setBlackPixel(imageData, x, 5);
            }
            for (let y = 4; y < 24; y++) {
                const x = 21 - Math.floor((y - 4) * 0.5);
                setBlackPixel(imageData, x, y);
                setBlackPixel(imageData, x + 1, y);
            }
            break;

        case 8:
            for (let angle = 0; angle < 360; angle += 8) {
                const rad = angle * Math.PI / 180;
                setBlackPixel(imageData, Math.round(center + 5 * Math.cos(rad)), Math.round(8 + 4 * Math.sin(rad)));
                setBlackPixel(imageData, Math.round(center + 6 * Math.cos(rad)), Math.round(19 + 5 * Math.sin(rad)));
            }
            break;

        case 9:
            for (let y = 4; y < 24; y++) setBlackPixel(imageData, center + 6, y);
            for (let x = center - 6; x <= center + 6; x++) {
                setBlackPixel(imageData, x, 4);
                setBlackPixel(imageData, x, 13);
            }
            for (let y = 4; y < 14; y++) setBlackPixel(imageData, center - 6, y);
            break;

        default:
            for (let i = 4; i < 24; i++) {
                setBlackPixel(imageData, center, i);
                setBlackPixel(imageData, i, center);
            }
    }

    return imageData;
}

/**
 * 函数名称：shiftImage
 * 功能说明：将图像平移，模拟字符位置扰动
 */
function shiftImage(imageData, dx = 0, dy = 0) {
    const result = createBlankImage(imageData.width);

    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const srcIdx = (y * imageData.width + x) * 4;
            const tx = x + dx;
            const ty = y + dy;

            if (tx >= 0 && tx < imageData.width && ty >= 0 && ty < imageData.height) {
                const dstIdx = (ty * imageData.width + tx) * 4;
                result.data[dstIdx] = imageData.data[srcIdx];
                result.data[dstIdx + 1] = imageData.data[srcIdx + 1];
                result.data[dstIdx + 2] = imageData.data[srcIdx + 2];
                result.data[dstIdx + 3] = imageData.data[srcIdx + 3];
            }
        }
    }

    return result;
}

/**
 * 函数名称：addSaltPepperNoise
 * 功能说明：添加椒盐噪声
 */
function addSaltPepperNoise(imageData, density = 0.03, random = seededRandom(42)) {
    const result = createImageData(imageData.width, imageData.height);
    result.data.set(imageData.data);

    // 与第05章一致：逐像素独立抽样，density表示被选中的概率。
    // 重复随机坐标会使实际覆盖率低于名义密度，因此不采用有放回抽样。
    for (let idx = 0; idx < result.data.length; idx += 4) {
        if (random() >= density) continue;
        const value = random() < 0.5 ? 0 : 255;
        result.data[idx] = value;
        result.data[idx + 1] = value;
        result.data[idx + 2] = value;
        result.data[idx + 3] = 255;
    }

    return result;
}

/**
 * 函数名称：createUnknownSymbol
 * 功能说明：创建训练集中不存在的符号（用于拒识演示）
 */
function createUnknownSymbol(size = 28) {
    const imageData = createBlankImage(size);

    // 画一个“X”形
    for (let i = 5; i < size - 5; i++) {
        setBlackPixel(imageData, i, i);
        setBlackPixel(imageData, size - 1 - i, i);
    }

    return imageData;
}

/**
 * 先划分造字配置，再生成图像。一个配置下所有类别/增强图留在同一部分。
 * 几何变换是合成来源的定义，不代表收集到了独立真实书写者。
 */
function buildDemoDataset(seed = 20260911) {
    const random = seededRandom(seed);
    const sources = Array.from({ length: 12 }, (_, i) => ({
        sourceId: `synthetic-style-${i}`,
        scaleX: 0.72 + random() * 0.32,
        scaleY: 0.78 + random() * 0.25,
        shear: -0.28 + i * 0.05,
        thick: i % 3 === 0
    }));
    const outer = splitTrainTest(sources, { testRatio: 0.25, seed });
    const inner = splitTrainTest(outer.train, { testRatio: 1 / 3, seed: seed + 1 });

    function renderSource(digit, source) {
        const base = createDigitImage(digit);
        const out = createBlankImage(28);
        for (let y = 0; y < 28; y++) {
            for (let x = 0; x < 28; x++) {
                if (base.data[(y * 28 + x) * 4] >= 128) continue;
                const tx = Math.round(14 + (x - 14) * source.scaleX + (y - 14) * source.shear);
                const ty = Math.round(14 + (y - 14) * source.scaleY);
                setBlackPixel(out, tx, ty);
                if (source.thick) setBlackPixel(out, tx + 1, ty);
            }
        }
        return out;
    }

    function materialize(selected, augment) {
        const samples = [];
        for (const source of selected) {
            for (let digit = 0; digit <= 9; digit++) {
                const base = renderSource(digit, source);
                const images = augment ? [base, shiftImage(base, 1, -1), addSaltPepperNoise(base, 0.01, random)] : [base];
                images.forEach((imageData, variant) => samples.push({
                    label: String(digit), sourceId: source.sourceId,
                    id: `${source.sourceId}-digit-${digit}-variant-${variant}`, imageData
                }));
            }
        }
        return samples;
    }
    return {
        train: materialize(inner.train, true),
        validation: materialize(inner.test, false),
        test: materialize(outer.test, false),
        seed,
        sourceCounts: { train: inner.train.length, validation: inner.test.length, test: outer.test.length }
    };
}

/** 仅看验证集；同分先较小 K，再普通投票。此函数绝不接收测试集。 */
function selectDemoParameters(classifier, validationSet) {
    const results = [];
    for (const weightedVote of [false, true]) {
        const tuning = classifier.tuneK(validationSet, [1, 3, 5, 7, 9], { weightedVote });
        results.push(...tuning.results.map(item => ({ ...item, weightedVote })));
    }
    results.sort((a, b) => b.accuracy - a.accuracy || a.k - b.k || Number(a.weightedVote) - Number(b.weightedVote));
    const chosen = results[0];
    classifier.options.k = chosen.k;
    classifier.options.weightedVote = chosen.weightedVote;
    return { chosen, results };
}

return { buildDemoDataset, createDigitImage, createUnknownSymbol, selectDemoParameters };
});
