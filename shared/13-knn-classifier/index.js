/**
 * KNN 分类器模块 - 第 13 章
 *
 * 本模块实现 K-Nearest Neighbors (KNN) 分类算法，核心能力包括：
 * - 从图像构建训练样本（复用第11章特征提取 + 第12章预处理）
 * - K 近邻搜索与多数投票/加权投票
 * - 训练集/测试集划分
 * - 分类准确率与混淆矩阵评估
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../12-template-matching'), require('../11-feature-extraction'));
    } else {
        root.OCRKNN = factory(root.OCRTemplates, root.OCRFeatures);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (templateMatching, featureExtraction) {
const {
    createTemplate,
    calculateDistance: calculateTemplateDistance
} = templateMatching;

const {
    normalizeFeatures,
    extractStatisticalFeatures
} = featureExtraction;

/**
 * 函数名称：calculateDistance
 * 功能说明：计算两个特征向量之间的距离
 *
 * 原理解释：
 * - KNN 的核心是“距离最近”的样本
 * - 本函数统一封装多种距离度量，便于实验比较
 *
 * @param {number[]} a - 特征向量 A
 * @param {number[]} b - 特征向量 B
 * @param {string} metric - 距离度量方法
 * @returns {number} 距离值（越小越相似）
 */
function calculateDistance(a, b, metric = 'euclidean') {
    return calculateTemplateDistance(a, b, metric);
}

/**
 * 函数名称：getKNearestNeighbors
 * 功能说明：从训练集中找到距离最近的 K 个样本
 *
 * 原理解释：
 * - 对输入样本与全部训练样本计算距离
 * - 按距离升序排序并截取前 K 项
 * - 时间复杂度 O(ND + N log N)，N 为训练样本数，D 为特征维度
 *
 * @param {number[]} features - 待分类样本特征
 * @param {Array<{label: string, features: number[]}>} trainingSet - 训练集
 * @param {number} k - 邻居数量
 * @param {string} metric - 距离度量方法
 * @returns {Array<{label: string, distance: number, index: number}>} 最近邻列表
 */
function getKNearestNeighbors(features, trainingSet, k = 3, metric = 'euclidean') {
    if (!Number.isInteger(k) || k <= 0) throw new Error('k 必须是正整数');
    if (!Array.isArray(trainingSet) || trainingSet.length === 0) {
        return [];
    }

    const neighbors = trainingSet.map((sample, index) => ({
        label: sample.label,
        distance: calculateDistance(features, sample.features, metric),
        index
    }));

    neighbors.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return String(a.label).localeCompare(String(b.label));
    });

    const safeK = Math.max(1, Math.min(k, neighbors.length));
    return neighbors.slice(0, safeK);
}

/**
 * 函数名称：voteByNeighbors
 * 功能说明：对 K 个邻居进行投票，得到最终类别
 *
 * 原理解释：
 * - 普通投票：每个邻居 1 票
 * - 加权投票：距离越近权重越大（1 / (d + ε)）
 * - 票数或权重占比是局部支持率，不是校准的正确概率
 *
 * @param {Array<{label: string, distance: number}>} neighbors - 最近邻列表
 * @param {object} options - 配置项
 * @param {boolean} options.weighted - 是否加权投票
 * @param {number} options.epsilon - 防止除零的小常数
 * @returns {object} 投票结果
 */
function voteByNeighbors(neighbors, options = {}) {
    const {
        weighted = false,
        epsilon = 1e-6
    } = options;

    if (!Array.isArray(neighbors) || neighbors.length === 0) {
        return {
            label: null,
            confidence: 0,
            votes: []
        };
    }

    const voteMap = new Map();
    let totalScore = 0;

    for (const item of neighbors) {
        const label = String(item.label);
        const score = weighted ? 1 / (item.distance + epsilon) : 1;

        if (!voteMap.has(label)) {
            voteMap.set(label, {
                label,
                score: 0,
                count: 0,
                distanceSum: 0,
                minDistance: Infinity
            });
        }

        const entry = voteMap.get(label);
        entry.score += score;
        entry.count += 1;
        entry.distanceSum += item.distance;
        entry.minDistance = Math.min(entry.minDistance, item.distance);
        totalScore += score;
    }

    const votes = Array.from(voteMap.values()).map((entry) => ({
        label: entry.label,
        score: entry.score,
        count: entry.count,
        avgDistance: entry.distanceSum / entry.count,
        minDistance: entry.minDistance,
        ratio: totalScore > 0 ? entry.score / totalScore : 0
    }));

    votes.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.avgDistance !== b.avgDistance) return a.avgDistance - b.avgDistance;
        if (a.minDistance !== b.minDistance) return a.minDistance - b.minDistance;
        return String(a.label).localeCompare(String(b.label));
    });

    return {
        label: votes[0].label,
        confidence: votes[0].ratio,
        votes
    };
}

/**
 * 函数名称：createSeededRandom
 * 功能说明：创建可复现的伪随机数生成器
 *
 * @param {number} seed - 随机种子
 * @returns {Function} 生成 [0, 1) 随机数的函数
 */
function createSeededRandom(seed = 42) {
    let state = seed >>> 0;

    return function nextRandom() {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

/**
 * 函数名称：splitTrainTest
 * 功能说明：将样本划分为训练集和测试集
 *
 * 原理解释：
 * - 机器学习中需要将数据拆分为“训练”和“评估”两部分
 * - 默认打乱后划分，避免样本顺序带来的偏差
 *
 * @param {Array<any>} samples - 样本数组
 * @param {object} options - 配置项
 * @param {number} options.testRatio - 测试集比例
 * @param {boolean} options.shuffle - 是否打乱
 * @param {number} options.seed - 随机种子
 * @returns {{train: any[], test: any[]}} 划分结果
 */
function splitTrainTest(samples, options = {}) {
    const {
        testRatio = 0.2,
        shuffle = true,
        seed = 42,
        groupBy = null
    } = options;

    if (!Array.isArray(samples)) {
        throw new Error('samples 必须是数组');
    }

    if (!Number.isFinite(testRatio) || testRatio < 0 || testRatio > 1) {
        throw new Error('testRatio 必须在 [0, 1] 范围内');
    }

    // 分组时整体分配同一来源的所有增强样本；比例按组数计算，样本数可不均等。
    if (groupBy !== null) {
        const getGroup = typeof groupBy === 'function' ? groupBy : sample => sample[groupBy];
        const groups = new Map();
        for (const sample of samples) {
            const key = getGroup(sample);
            if (key === undefined || key === null) throw new Error('分组字段不能为空');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(sample);
        }
        const split = splitTrainTest(Array.from(groups.values()), { testRatio, shuffle, seed });
        return { train: split.train.flat(), test: split.test.flat() };
    }
    const data = samples.slice();

    if (shuffle && data.length > 1) {
        const random = createSeededRandom(seed);

        for (let i = data.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [data[i], data[j]] = [data[j], data[i]];
        }
    }

    // 比例 0/1 按字面含义返回；中间比例向下取整，不凭空强制生成评估样本。
    const testCount = Math.floor(data.length * testRatio);
    const splitIndex = data.length - testCount;

    return {
        train: data.slice(0, splitIndex),
        test: data.slice(splitIndex)
    };
}

/**
 * 函数名称：calculateAccuracy
 * 功能说明：计算分类准确率
 *
 * @param {string[]} trueLabels - 真实标签
 * @param {string[]} predictedLabels - 预测标签
 * @returns {number} 准确率 [0, 1]
 */
function calculateAccuracy(trueLabels, predictedLabels) {
    if (trueLabels.length !== predictedLabels.length) {
        throw new Error('标签长度不一致');
    }

    if (trueLabels.length === 0) {
        return 0;
    }

    let correct = 0;

    for (let i = 0; i < trueLabels.length; i++) {
        if (String(trueLabels[i]) === String(predictedLabels[i])) {
            correct++;
        }
    }

    return correct / trueLabels.length;
}

/**
 * 函数名称：buildConfusionMatrix
 * 功能说明：构建混淆矩阵
 *
 * @param {string[]} trueLabels - 真实标签
 * @param {string[]} predictedLabels - 预测标签
 * @param {string[]} labels - 指定标签顺序（可选）
 * @returns {{labels: string[], matrix: object}} 混淆矩阵对象
 */
function buildConfusionMatrix(trueLabels, predictedLabels, labels = null) {
    if (trueLabels.length !== predictedLabels.length) {
        throw new Error('标签长度不一致');
    }

    const labelSet = new Set((labels || []).map(String));

    if (!labels) {
        for (const v of trueLabels) labelSet.add(String(v));
        for (const v of predictedLabels) labelSet.add(String(v));
    }

    const finalLabels = labels ? Array.from(labelSet) : Array.from(labelSet).sort((a, b) => a.localeCompare(b));
    const matrix = {};

    for (const actual of finalLabels) {
        matrix[actual] = {};
        for (const predicted of finalLabels) {
            matrix[actual][predicted] = 0;
        }
    }

    for (let i = 0; i < trueLabels.length; i++) {
        const actual = String(trueLabels[i]);
        const predicted = String(predictedLabels[i]);

        if (!labelSet.has(actual) || !labelSet.has(predicted)) {
            throw new Error('指定 labels 未覆盖所有真实/预测标签');
        }

        matrix[actual][predicted] += 1;
    }

    return {
        labels: finalLabels,
        matrix
    };
}

/**
 * 函数名称：createKNNSample
 * 功能说明：将图像样本转换为 KNN 可用的训练样本
 *
 * 原理解释：
 * - 复用第12章的尺寸归一化与特征提取流程
 * - 可选对特征做 L2/Min-Max/Z-Score 归一化
 *
 * @param {ImageData} imageData - 输入图像
 * @param {string} label - 标签
 * @param {object} options - 配置项
 * @returns {{label: string, features: number[]}} KNN 样本
 */
function createKNNSample(imageData, label, options = {}) {
    const {
        imageSize = 28,
        featureType = 'combined',
        padding = 0.1,
        normalizeMethod = 'l2'
    } = options;

    const template = createTemplate(imageData, String(label), {
        targetSize: imageSize,
        featureType,
        padding
    });

    const features = normalizeMethod && normalizeMethod !== 'none'
        ? normalizeFeatures(template.features, normalizeMethod)
        : template.features.slice();

    return {
        label: String(label),
        features
    };
}

/**
 * 函数名称：buildKNNDataset
 * 功能说明：批量构建 KNN 训练数据集
 *
 * @param {Array<{imageData: ImageData, label: string}>} samples - 图像样本数组
 * @param {object} options - 配置项
 * @returns {Array<{label: string, features: number[]}>} KNN 数据集
 */
function buildKNNDataset(samples, options = {}) {
    if (!Array.isArray(samples)) {
        throw new Error('samples 必须是数组');
    }

    return samples.map((sample) => createKNNSample(sample.imageData, sample.label, options));
}

/**
 * KNN 分类器类
 *
 * 功能说明：
 * - 管理训练样本
 * - 执行 KNN 预测
 * - 支持拒绝阈值（未知字符拒识）
 * - 支持 K 值调参
 */
class KNNClassifier {
    /**
     * @param {object} options - 配置项
     */
    constructor(options = {}) {
        this.options = {
            k: 3,
            distanceMetric: 'euclidean',
            weightedVote: false,
            rejectThreshold: null,
            imageSize: 28,
            featureType: 'combined',
            padding: 0.1,
            normalizeMethod: 'l2',
            ...options
        };

        this.samples = [];
    }

    /**
     * 函数名称：fit
     * 功能说明：使用特征样本训练分类器
     *
     * @param {Array<{label: string, features: number[]}>} trainingSet - 训练集
     * @returns {KNNClassifier} 当前实例
     */
    fit(trainingSet) {
        if (!Array.isArray(trainingSet) || trainingSet.length === 0) {
            throw new Error('trainingSet 不能为空');
        }

        this.samples = trainingSet.map((sample, index) => {
            if (!Array.isArray(sample.features)) {
                throw new Error(`训练样本第 ${index} 项缺少 features`);
            }

            const normalized = this.options.normalizeMethod && this.options.normalizeMethod !== 'none'
                ? normalizeFeatures(sample.features, this.options.normalizeMethod)
                : sample.features.slice();

            return {
                label: String(sample.label),
                features: normalized
            };
        });

        return this;
    }

    /**
     * 函数名称：fitFromImages
     * 功能说明：直接使用图像样本训练分类器
     *
     * @param {Array<{imageData: ImageData, label: string}>} samples - 图像训练集
     * @returns {KNNClassifier} 当前实例
     */
    fitFromImages(samples) {
        const dataset = buildKNNDataset(samples, {
            imageSize: this.options.imageSize,
            featureType: this.options.featureType,
            padding: this.options.padding,
            normalizeMethod: 'none'
        });

        return this.fit(dataset);
    }

    /**
     * 函数名称：addSample
     * 功能说明：添加单个特征样本
     *
     * @param {string} label - 标签
     * @param {number[]} features - 特征向量
     */
    addSample(label, features) {
        if (!Array.isArray(features)) {
            throw new Error('features 必须是数组');
        }

        const normalized = this.options.normalizeMethod && this.options.normalizeMethod !== 'none'
            ? normalizeFeatures(features, this.options.normalizeMethod)
            : features.slice();

        this.samples.push({
            label: String(label),
            features: normalized
        });
    }

    /**
     * 函数名称：addSampleFromImage
     * 功能说明：从图像添加单个训练样本
     *
     * @param {ImageData} imageData - 图像
     * @param {string} label - 标签
     */
    addSampleFromImage(imageData, label) {
        const sample = createKNNSample(imageData, label, {
            imageSize: this.options.imageSize,
            featureType: this.options.featureType,
            padding: this.options.padding,
            normalizeMethod: this.options.normalizeMethod
        });

        this.samples.push(sample);
    }

    /**
     * 函数名称：clear
     * 功能说明：清空训练数据
     */
    clear() {
        this.samples = [];
    }

    /**
     * 函数名称：getStats
     * 功能说明：获取分类器统计信息
     *
     * @returns {object} 统计结果
     */
    getStats() {
        const classDistribution = {};

        for (const sample of this.samples) {
            classDistribution[sample.label] = (classDistribution[sample.label] || 0) + 1;
        }

        return {
            numSamples: this.samples.length,
            numClasses: Object.keys(classDistribution).length,
            classDistribution,
            k: this.options.k,
            metric: this.options.distanceMetric,
            weightedVote: this.options.weightedVote
        };
    }

    /**
     * 函数名称：findNeighbors
     * 功能说明：查找最近邻（内部工具方法）
     *
     * @param {number[]} features - 输入特征
     * @param {number} k - 邻居数
     * @returns {Array<{label: string, distance: number, index: number}>} 最近邻列表
     */
    findNeighbors(features, k = this.options.k) {
        if (this.samples.length === 0) {
            return [];
        }

        const normalizedQuery = this.options.normalizeMethod && this.options.normalizeMethod !== 'none'
            ? normalizeFeatures(features, this.options.normalizeMethod)
            : features.slice();

        return getKNearestNeighbors(
            normalizedQuery,
            this.samples,
            k,
            this.options.distanceMetric
        );
    }

    /**
     * 函数名称：predict
     * 功能说明：基于特征向量进行分类
     *
     * @param {number[]} features - 输入特征
     * @param {object} options - 临时预测配置
     * @returns {object} 预测结果
     */
    predict(features, options = {}) {
        if (!Array.isArray(features)) {
            throw new Error('features 必须是数组');
        }

        if (this.samples.length === 0) {
            return {
                label: null,
                confidence: 0,
                rejected: true,
                reason: '训练集为空',
                neighbors: [],
                votes: []
            };
        }

        const k = options.k !== undefined ? options.k : this.options.k;
        const weightedVote = options.weightedVote !== undefined
            ? options.weightedVote
            : this.options.weightedVote;
        const rejectThreshold = options.rejectThreshold !== undefined
            ? options.rejectThreshold
            : this.options.rejectThreshold;

        const neighbors = this.findNeighbors(features, k);
        const voteResult = voteByNeighbors(neighbors, { weighted: weightedVote });

        const nearestDistance = neighbors.length > 0 ? neighbors[0].distance : Infinity;

        if (rejectThreshold !== null && nearestDistance > rejectThreshold) {
            return {
                label: null,
                confidence: voteResult.confidence,
                distance: nearestDistance,
                rejected: true,
                reason: '超过拒绝阈值',
                neighbors,
                votes: voteResult.votes
            };
        }

        return {
            label: voteResult.label,
            confidence: voteResult.confidence,
            distance: nearestDistance,
            rejected: false,
            neighbors,
            votes: voteResult.votes
        };
    }

    /**
     * 函数名称：predictFromImage
     * 功能说明：直接对图像进行分类
     *
     * @param {ImageData} imageData - 输入图像
     * @param {object} options - 临时预测配置
     * @returns {object} 预测结果
     */
    predictFromImage(imageData, options = {}) {
        if (extractStatisticalFeatures(imageData).foregroundCount === 0) {
            return { label: null, confidence: 0, distance: Infinity, rejected: true, reason: '图像没有前景字符', neighbors: [], votes: [] };
        }
        const sample = createKNNSample(imageData, 'unknown', {
            imageSize: this.options.imageSize,
            featureType: this.options.featureType,
            padding: this.options.padding,
            normalizeMethod: 'none'
        });

        return this.predict(sample.features, options);
    }

    /**
     * 函数名称：predictBatch
     * 功能说明：批量预测特征样本
     *
     * @param {Array<number[]>} featureList - 特征列表
     * @param {object} options - 临时预测配置
     * @returns {object[]} 预测结果数组
     */
    predictBatch(featureList, options = {}) {
        return featureList.map((features) => this.predict(features, options));
    }

    /**
     * 函数名称：predictBatchFromImages
     * 功能说明：批量预测图像样本
     *
     * @param {ImageData[]} images - 图像列表
     * @param {object} options - 临时预测配置
     * @returns {object[]} 预测结果数组
     */
    predictBatchFromImages(images, options = {}) {
        return images.map((imageData) => this.predictFromImage(imageData, options));
    }

    /**
     * 函数名称：evaluate
     * 功能说明：评估分类器在测试集上的性能
     *
     * @param {Array<{label: string, features?: number[], imageData?: ImageData}>} testSet - 测试集
     * @param {object} options - 临时预测配置
     * @returns {object} 评估结果
     */
    evaluate(testSet, options = {}) {
        if (!Array.isArray(testSet)) {
            throw new Error('testSet 必须是数组');
        }

        const trueLabels = [];
        const predictedLabels = [];
        const errors = [];
        let correct = 0;
        let rejected = 0;

        testSet.forEach((sample, index) => {
            if (!sample || sample.label === undefined) {
                throw new Error(`测试样本第 ${index} 项缺少 label`);
            }

            let prediction;

            if (Array.isArray(sample.features)) {
                prediction = this.predict(sample.features, options);
            } else if (sample.imageData) {
                prediction = this.predictFromImage(sample.imageData, options);
            } else {
                throw new Error(`测试样本第 ${index} 项缺少 features 或 imageData`);
            }

            const actual = String(sample.label);
            const predicted = prediction.rejected ? 'REJECTED' : String(prediction.label);

            trueLabels.push(actual);
            predictedLabels.push(predicted);

            if (prediction.rejected) {
                rejected++;
                errors.push({
                    index,
                    actual,
                    predicted,
                    type: 'rejected',
                    distance: prediction.distance
                });
            } else if (predicted === actual) {
                correct++;
            } else {
                errors.push({
                    index,
                    actual,
                    predicted,
                    type: 'misclassified',
                    distance: prediction.distance
                });
            }
        });

        const accuracy = trueLabels.length > 0 ? correct / trueLabels.length : 0;
        const confusion = buildConfusionMatrix(trueLabels, predictedLabels);

        return {
            total: trueLabels.length,
            correct,
            rejected,
            errors: errors.length,
            accuracy,
            confusionMatrix: confusion.matrix,
            labels: confusion.labels,
            errorDetails: errors
        };
    }

    /**
     * 函数名称：tuneK
     * 功能说明：在验证集上选择最优 K 值
     *
     * @param {Array<{label: string, features?: number[], imageData?: ImageData}>} validationSet - 验证集
     * @param {number[]} candidateKs - 候选 K 列表
     * @param {object} options - 预测配置
     * @returns {{bestK: number, results: Array<{k:number, accuracy:number}>}} 调参结果
     */
    tuneK(validationSet, candidateKs = [1, 3, 5, 7], options = {}) {
        if (!Array.isArray(candidateKs) || candidateKs.length === 0) {
            throw new Error('candidateKs 不能为空');
        }

        if (!Array.isArray(validationSet) || validationSet.length === 0) throw new Error('验证集不能为空');
        if (this.samples.length === 0) throw new Error('训练集不能为空');
        if (candidateKs.some(k => !Number.isInteger(k) || k <= 0)) throw new Error('候选 k 必须是正整数');
        const results = [];
        let bestK = candidateKs[0];
        let bestAccuracy = -Infinity;

        for (const k of candidateKs) {
            const evaluation = this.evaluate(validationSet, {
                ...options,
                k
            });

            results.push({
                k,
                accuracy: evaluation.accuracy
            });

            if (
                evaluation.accuracy > bestAccuracy ||
                (evaluation.accuracy === bestAccuracy && k < bestK)
            ) {
                bestAccuracy = evaluation.accuracy;
                bestK = k;
            }
        }

        this.options.k = bestK;

        return {
            bestK,
            results
        };
    }

    /**
     * 函数名称：export
     * 功能说明：导出分类器参数与训练数据
     *
     * @returns {object} 可序列化对象
     */
    export() {
        return {
            options: { ...this.options },
            samples: this.samples.map((sample) => ({
                label: sample.label,
                features: sample.features.slice()
            }))
        };
    }

    /**
     * 函数名称：import
     * 功能说明：导入分类器参数与训练数据
     *
     * @param {object} data - 导入数据
     */
    import(data) {
        this.options = {
            ...this.options,
            ...(data.options || {})
        };

        this.samples = Array.isArray(data.samples)
            ? data.samples.map((sample) => ({
                label: String(sample.label),
                features: sample.features.slice()
            }))
            : [];
    }
}

/**
 * 函数名称：evaluateKValues
 * 功能说明：便捷函数，比较多个 K 值下的准确率
 *
 * @param {KNNClassifier} classifier - 已训练分类器
 * @param {Array<{label: string, features?: number[], imageData?: ImageData}>} validationSet - 验证集
 * @param {number[]} candidateKs - 候选 K 列表
 * @returns {{bestK: number, results: Array<{k:number, accuracy:number}>}} 对比结果
 */
function evaluateKValues(classifier, validationSet, candidateKs = [1, 3, 5, 7]) {
    return classifier.tuneK(validationSet, candidateKs);
}

return {
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
};

});
