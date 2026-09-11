/**
 * KNN 分类器模块单元测试
 *
 * 测试第 13 章核心能力：
 * - 距离计算
 * - 近邻搜索与投票
 * - 训练/预测/评估流程
 */

const {
    calculateDistance,
    getKNearestNeighbors,
    voteByNeighbors,
    splitTrainTest,
    calculateAccuracy,
    buildConfusionMatrix,
    createKNNSample,
    buildKNNDataset,
    KNNClassifier,
    evaluateKValues
} = require('../13-knn-classifier');

const { MockImageData } = require('../core');

/**
 * 创建白底黑字测试图像
 */
function createTestImage(width, height, foregroundPixels = []) {
    const imageData = new MockImageData(width, height);

    // 白色背景
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255;
        imageData.data[i + 1] = 255;
        imageData.data[i + 2] = 255;
        imageData.data[i + 3] = 255;
    }

    // 前景像素（黑色）
    for (const [x, y] of foregroundPixels) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            const idx = (y * width + x) * 4;
            imageData.data[idx] = 0;
            imageData.data[idx + 1] = 0;
            imageData.data[idx + 2] = 0;
        }
    }

    return imageData;
}

/**
 * 生成简单数字图像（0 / 1 / 7）
 */
function createDigitImage(digit, size = 28) {
    const foreground = [];
    const center = Math.floor(size / 2);

    switch (digit) {
        case 0:
            for (let angle = 0; angle < 360; angle += 10) {
                const rad = angle * Math.PI / 180;
                const x = Math.round(center + (size / 4) * Math.cos(rad));
                const y = Math.round(center + (size / 3) * Math.sin(rad));
                foreground.push([x, y]);
            }
            break;

        case 1:
            for (let y = 4; y < size - 4; y++) {
                foreground.push([center, y]);
                foreground.push([center + 1, y]);
            }
            break;

        case 7:
            for (let x = center - 6; x <= center + 6; x++) {
                foreground.push([x, 4]);
                foreground.push([x, 5]);
            }
            for (let y = 4; y < size - 4; y++) {
                const x = center + 6 - Math.floor((y - 4) * 0.35);
                foreground.push([x, y]);
            }
            break;

        default:
            for (let i = 4; i < size - 4; i++) {
                foreground.push([center, i]);
                foreground.push([i, center]);
            }
    }

    return createTestImage(size, size, foreground);
}

describe('calculateDistance', () => {
    test('欧氏距离应该正确', () => {
        expect(calculateDistance([0, 0], [3, 4], 'euclidean')).toBe(5);
    });

    test('曼哈顿距离应该正确', () => {
        expect(calculateDistance([0, 0], [3, 4], 'manhattan')).toBe(7);
    });

    test('余弦距离应该正确', () => {
        expect(calculateDistance([1, 0], [1, 0], 'cosine')).toBeCloseTo(0);
        expect(calculateDistance([1, 0], [0, 1], 'cosine')).toBeCloseTo(1);
    });
});

describe('getKNearestNeighbors', () => {
    const trainingSet = [
        { label: 'A', features: [0, 0] },
        { label: 'B', features: [1, 1] },
        { label: 'C', features: [2, 2] }
    ];

    test('应返回距离最近的 K 个邻居', () => {
        const neighbors = getKNearestNeighbors([0.1, 0.2], trainingSet, 2);
        expect(neighbors.length).toBe(2);
        expect(neighbors[0].label).toBe('A');
        expect(neighbors[1].distance).toBeGreaterThanOrEqual(neighbors[0].distance);
    });

    test('k 超过训练集大小时应自动截断', () => {
        const neighbors = getKNearestNeighbors([0, 0], trainingSet, 10);
        expect(neighbors.length).toBe(3);
    });

    test('空训练集应返回空数组', () => {
        expect(getKNearestNeighbors([0, 0], [], 3)).toEqual([]);
    });
});

describe('voteByNeighbors', () => {
    test('普通投票应返回多数类别', () => {
        const neighbors = [
            { label: '0', distance: 0.1 },
            { label: '1', distance: 0.2 },
            { label: '1', distance: 0.3 }
        ];

        const result = voteByNeighbors(neighbors, { weighted: false });
        expect(result.label).toBe('1');
        expect(result.confidence).toBeCloseTo(2 / 3, 3);
    });

    test('加权投票应偏向更近的样本', () => {
        const neighbors = [
            { label: '0', distance: 0.01 },
            { label: '1', distance: 0.2 },
            { label: '1', distance: 0.3 }
        ];

        const result = voteByNeighbors(neighbors, { weighted: true });
        expect(result.label).toBe('0');
        expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('空邻居列表应返回空结果', () => {
        const result = voteByNeighbors([]);
        expect(result.label).toBeNull();
        expect(result.confidence).toBe(0);
    });
});

describe('splitTrainTest', () => {
    test('应返回训练集和测试集', () => {
        const samples = Array.from({ length: 10 }, (_, i) => i);
        const { train, test } = splitTrainTest(samples, { testRatio: 0.3, seed: 123 });

        expect(train.length + test.length).toBe(10);
        expect(test.length).toBe(3);
        expect(train.length).toBe(7);
    });

    test('相同 seed 应得到相同结果', () => {
        const samples = Array.from({ length: 20 }, (_, i) => i);
        const split1 = splitTrainTest(samples, { testRatio: 0.2, seed: 7 });
        const split2 = splitTrainTest(samples, { testRatio: 0.2, seed: 7 });

        expect(split1.train).toEqual(split2.train);
        expect(split1.test).toEqual(split2.test);
    });
});

describe('评估辅助函数', () => {
    test('calculateAccuracy 应正确计算准确率', () => {
        const accuracy = calculateAccuracy(['0', '1', '2'], ['0', 'x', '2']);
        expect(accuracy).toBeCloseTo(2 / 3, 5);
    });

    test('buildConfusionMatrix 应正确统计', () => {
        const trueLabels = ['0', '0', '1'];
        const predictedLabels = ['0', '1', '1'];
        const result = buildConfusionMatrix(trueLabels, predictedLabels);

        expect(result.matrix['0']['0']).toBe(1);
        expect(result.matrix['0']['1']).toBe(1);
        expect(result.matrix['1']['1']).toBe(1);
    });
});

describe('createKNNSample / buildKNNDataset', () => {
    test('应正确从图像创建样本', () => {
        const image = createDigitImage(0);
        const sample = createKNNSample(image, '0', { featureType: 'zone', normalizeMethod: 'none' });

        expect(sample.label).toBe('0');
        expect(Array.isArray(sample.features)).toBe(true);
        expect(sample.features.length).toBe(16); // 4x4 网格
    });

    test('应批量构建数据集', () => {
        const dataset = buildKNNDataset([
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' }
        ], { featureType: 'zone' });

        expect(dataset.length).toBe(2);
        expect(dataset[0].features.length).toBeGreaterThan(0);
    });
});

describe('KNNClassifier', () => {
    let classifier;

    beforeEach(() => {
        classifier = new KNNClassifier({
            k: 3,
            featureType: 'zone',
            distanceMetric: 'euclidean',
            weightedVote: false
        });
    });

    test('应能从图像训练并正确识别', () => {
        classifier.fitFromImages([
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' },
            { imageData: createDigitImage(7), label: '7' }
        ]);

        const result = classifier.predictFromImage(createDigitImage(1));

        expect(result.rejected).toBe(false);
        expect(result.label).toBe('1');
        expect(result.confidence).toBeGreaterThan(0.2);
    });

    test('应能添加样本并返回统计信息', () => {
        classifier.addSample('A', [1, 0, 0]);
        classifier.addSample('B', [0, 1, 0]);
        classifier.addSample('A', [1, 0.1, 0]);

        const stats = classifier.getStats();
        expect(stats.numSamples).toBe(3);
        expect(stats.numClasses).toBe(2);
        expect(stats.classDistribution['A']).toBe(2);
    });

    test('空训练集预测应拒绝', () => {
        const result = classifier.predict([0, 1, 2]);
        expect(result.rejected).toBe(true);
        expect(result.reason).toBe('训练集为空');
    });

    test('设置拒绝阈值后，远距离样本应被拒绝', () => {
        const strict = new KNNClassifier({ k: 1, rejectThreshold: 0.01, normalizeMethod: 'none' });
        strict.addSample('A', [0, 0, 0]);

        const result = strict.predict([10, 10, 10]);
        expect(result.rejected).toBe(true);
        expect(result.reason).toBe('超过拒绝阈值');
    });

    test('evaluate 应返回准确率和混淆矩阵', () => {
        classifier.fitFromImages([
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' },
            { imageData: createDigitImage(7), label: '7' }
        ]);

        const evaluation = classifier.evaluate([
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' },
            { imageData: createDigitImage(7), label: '7' }
        ]);

        expect(evaluation.total).toBe(3);
        expect(evaluation.accuracy).toBeGreaterThanOrEqual(0.66);
        expect(evaluation.confusionMatrix).toBeDefined();
    });

    test('tuneK 与 evaluateKValues 应返回最优 K', () => {
        classifier.fitFromImages([
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' },
            { imageData: createDigitImage(7), label: '7' },
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' },
            { imageData: createDigitImage(7), label: '7' }
        ]);

        const validation = [
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' },
            { imageData: createDigitImage(7), label: '7' }
        ];

        const tuned = classifier.tuneK(validation, [1, 3, 5]);
        expect([1, 3, 5]).toContain(tuned.bestK);

        const helperResult = evaluateKValues(classifier, validation, [1, 3, 5]);
        expect([1, 3, 5]).toContain(helperResult.bestK);
    });

    test('导出导入后应保持样本数量', () => {
        classifier.fitFromImages([
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' }
        ]);

        const exported = classifier.export();

        const restored = new KNNClassifier();
        restored.import(exported);

        expect(restored.getStats().numSamples).toBe(classifier.getStats().numSamples);
        expect(restored.getStats().numClasses).toBe(classifier.getStats().numClasses);
    });
});
