/**
 * 模板匹配模块 - 第 12 章
 * 
 * 本模块提供基于模板匹配的字符识别功能，包括：
 * - 模板库管理
 * - 多种相似度度量
 * - 匹配决策与置信度计算
 * 
 * 模板匹配是最直观的字符识别方法，通过与标准模板比对来识别字符。
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../11-feature-extraction'));
    } else {
        root.OCRTemplates = factory(root.OCRFeatures);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (featureExtraction) {
const {
    extractPixelFeatures,
    extractHOGFeatures,
    extractStatisticalFeatures,
    statisticalFeaturesToVector,
    calculateHuMoments,
    logTransformHuMoments,
    extractProjectionFeatures,
    extractZoneFeatures,
    extractCombinedFeatures,
    euclideanDistance,
    cosineSimilarity,
    manhattanDistance,
    resizeImage,
    cropAndCenter,
    normalizeFeatures
} = featureExtraction;

// ==================== 相似度度量 ====================

/**
 * 计算归一化相关系数 (Normalized Cross-Correlation, NCC)
 * 
 * 原理说明：
 * 相关系数衡量两个向量的线性相关程度，取值范围 [-1, 1]。
 * 1 表示完全正相关，0 表示无相关，-1 表示完全负相关。
 * 归一化使其对亮度和对比度变化具有鲁棒性。
 * 
 * 公式：r = Σ((aᵢ - μₐ)(bᵢ - μ_b)) / (n × σₐ × σ_b)
 * 
 * @param {number[]} a - 向量 A
 * @param {number[]} b - 向量 B
 * @returns {number} 相关系数 [-1, 1]
 */
function normalizedCrossCorrelation(a, b) {
    if (a.length !== b.length) {
        throw new Error('向量长度不一致');
    }
    
    const n = a.length;
    if (n === 0) return 0;
    
    // 计算均值
    const meanA = a.reduce((sum, v) => sum + v, 0) / n;
    const meanB = b.reduce((sum, v) => sum + v, 0) / n;
    
    // 计算方差和协方差
    let varA = 0, varB = 0, covar = 0;
    
    for (let i = 0; i < n; i++) {
        const diffA = a[i] - meanA;
        const diffB = b[i] - meanB;
        varA += diffA * diffA;
        varB += diffB * diffB;
        covar += diffA * diffB;
    }
    
    const stdA = Math.sqrt(varA / n);
    const stdB = Math.sqrt(varB / n);
    
    // 避免除以零
    if (stdA === 0 || stdB === 0) {
        // Pearson/NCC 此时未定义。教学接口返回 0 占位，对应相关距离 1；不是完全相关。
        return 0;
    }
    
    return Math.max(-1, Math.min(1, covar / (n * stdA * stdB)));
}

/**
 * 计算距离
 * 
 * @param {number[]} a - 向量 A
 * @param {number[]} b - 向量 B
 * @param {string} metric - 距离度量方法
 * @returns {number} 距离值
 */
function calculateDistance(a, b, metric = 'euclidean') {
    switch (metric) {
        case 'euclidean':
            return euclideanDistance(a, b);
        case 'manhattan':
            return manhattanDistance(a, b);
        case 'cosine':
            // 余弦距离 = 1 - 余弦相似度
            return 1 - cosineSimilarity(a, b);
        case 'correlation':
            // 相关距离 = 1 - 相关系数
            return 1 - normalizedCrossCorrelation(a, b);
        default:
            throw new Error(`未知距离度量: ${metric}`);
    }
}

// ==================== 模板创建 ====================

/**
 * 从图像创建模板
 * 
 * 原理说明：
 * 模板是字符的标准表示，包括预处理后的图像和提取的特征向量。
 * 创建模板时需要进行尺寸归一化和居中对齐，确保可比性。
 * 
 * @param {ImageData} imageData - 输入图像
 * @param {string} label - 字符标签（如 '0', 'A'）
 * @param {object} options - 配置选项
 * @returns {object} 模板对象
 */
function createTemplate(imageData, label, options = {}) {
    const {
        targetSize = 28,            // 归一化尺寸
        featureType = 'combined',   // 特征类型
        padding = 0.1               // 边距比例
    } = options;
    
    // Step 1: 预处理 - 裁剪并居中
    const processed = cropAndCenter(imageData, targetSize, padding);
    
    // Step 2: 提取特征
    let features;
    
    switch (featureType) {
        case 'pixel':
            // 像素级特征
            features = extractPixelFeatures(processed, { 
                normalize: true, 
                binary: false 
            });
            break;
            
        case 'binary':
            // 二值像素特征
            features = extractPixelFeatures(processed, { 
                normalize: false, 
                binary: true 
            });
            break;
            
        case 'statistical':
            // 统计特征
            const stats = extractStatisticalFeatures(processed);
            const huMoments = calculateHuMoments(processed);
            features = [
                ...statisticalFeaturesToVector(stats),
                ...logTransformHuMoments(huMoments)
            ];
            break;
            
        case 'projection':
            // 投影特征
            const projection = extractProjectionFeatures(processed);
            features = projection.combined;
            break;
            
        case 'zone':
            // 网格特征
            features = extractZoneFeatures(processed, 4);
            break;
            
        case 'hog':
            features = extractHOGFeatures(processed);
            break;

        case 'combined':
            // 组合特征（推荐）
            const combined = extractCombinedFeatures(processed, {
                includePixels: false,
                includeStats: true,
                includeHuMoments: true,
                includeProjection: true,
                includeZone: true,
                includeHOG: false  // HOG 计算较慢，默认不包含
            });
            features = combined.all;
            break;
        default:
            throw new Error(`未知特征类型: ${featureType}`);
    }
    
    return {
        label,
        features,
        featureType,
        imageSize: targetSize
    };
}

/**
 * 批量构建模板库
 * 
 * @param {Array<{imageData: ImageData, label: string}>} samples - 样本数组
 * @param {object} options - 配置选项
 * @returns {Map<string, object[]>} 模板库
 */
function buildTemplateLibrary(samples, options = {}) {
    const library = new Map();
    
    for (const sample of samples) {
        const template = createTemplate(sample.imageData, sample.label, options);
        
        if (!library.has(sample.label)) {
            library.set(sample.label, []);
        }
        library.get(sample.label).push(template);
    }
    
    return library;
}

// ==================== 模板匹配 ====================

/**
 * 单次模板匹配
 * 
 * 原理说明：
 * 计算输入特征与所有模板的距离，返回排序后的匹配结果。
 * 
 * @param {number[]} features - 输入特征向量
 * @param {Map<string, object[]>} templateLibrary - 模板库
 * @param {object} options - 配置选项
 * @returns {Array<{label: string, distance: number}>} 排序后的匹配结果
 */
function matchTemplate(features, templateLibrary, options = {}) {
    const {
        metric = 'euclidean',    // 距离度量
        aggregation = 'min'      // 多模板聚合方式：'min' | 'mean'
    } = options;
    
    const results = [];
    
    for (const [label, templates] of templateLibrary) {
        const distances = templates.map(t => 
            calculateDistance(features, t.features, metric)
        );
        
        let distance;
        if (aggregation === 'mean') {
            distance = distances.reduce((a, b) => a + b, 0) / distances.length;
        } else {
            distance = Math.min(...distances);
        }
        
        results.push({ label, distance });
    }
    
    // 按距离排序
    return results.sort((a, b) => a.distance - b.distance);
}

/**
 * 计算匹配相对分数（沿用 confidence 字段名，不代表校准的正确概率）
 * 
 * 原理说明：
 * 基于距离计算候选间相对分数；远离所有模板时仍可能很高。可以使用多种方法：
 * - 简单方法：confidence = 1 - distance / maxDistance
 * - Softmax：使用指数函数归一化
 * 
 * @param {Array<{label: string, distance: number}>} results - 匹配结果
 * @param {object} options - 配置选项
 * @returns {Array<{label: string, distance: number, confidence: number}>}
 */
function calculateConfidence(results, options = {}) {
    const {
        method = 'softmax',     // 'simple' | 'softmax'
        temperature = 1.0       // Softmax 温度参数
    } = options;
    
    if (results.length === 0) return [];
    if (!Number.isFinite(temperature) || temperature <= 0) throw new Error('temperature 必须是有限正数');
    if (results.some(r => !Number.isFinite(r.distance) || r.distance < 0)) throw new Error('distance 必须是有限非负数');
    
    if (method === 'simple') {
        // 简单方法：基于最大距离归一化
        const maxDist = Math.max(...results.map(r => r.distance), 1e-6);
        return results.map(r => ({
            ...r,
            confidence: Math.max(0, 1 - r.distance / maxDist)
        }));
    } else {
        // Softmax 方法：指数归一化
        const negDistances = results.map(r => -r.distance / temperature);
        const maxNegDist = Math.max(...negDistances);
        
        // 数值稳定的 Softmax
        const expValues = negDistances.map(d => Math.exp(d - maxNegDist));
        const sumExp = expValues.reduce((a, b) => a + b, 0);
        
        return results.map((r, i) => ({
            ...r,
            confidence: expValues[i] / sumExp
        }));
    }
}

// ==================== 模板匹配器类 ====================

/**
 * 模板匹配器类
 * 
 * 功能说明：
 * - 管理模板库（添加、删除、查询）
 * - 执行字符识别
 * - 返回匹配结果和置信度
 * - 支持拒绝阈值（识别出未知字符）
 */
class TemplateMatcher {
    /**
     * 构造函数
     * 
     * @param {object} options - 配置选项
     */
    constructor(options = {}) {
        this.templates = new Map();  // 模板库：Map<label, template[]>
        this.options = {
            distanceMetric: 'euclidean',   // 距离度量方法
            featureType: 'combined',        // 特征类型
            imageSize: 28,                  // 归一化尺寸
            padding: 0.1,                  // 外接框居中的边距
            rejectThreshold: null,          // 拒绝阈值（null 表示不拒绝）
            aggregation: 'min',             // 多模板聚合方式
            ...options
        };
    }
    
    /**
     * 添加单个模板
     * 
     * @param {string} label - 字符标签
     * @param {number[]} features - 特征向量
     */
    addTemplate(label, features) {
        if (!this.templates.has(label)) {
            this.templates.set(label, []);
        }
        this.templates.get(label).push({
            label,
            features,
            featureType: this.options.featureType,
            padding: this.options.padding
        });
    }
    
    /**
     * 从图像添加模板
     * 
     * @param {ImageData} imageData - 字符图像
     * @param {string} label - 字符标签
     */
    addTemplateFromImage(imageData, label) {
        const template = createTemplate(imageData, label, {
            targetSize: this.options.imageSize,
            featureType: this.options.featureType,
            padding: this.options.padding
        });
        
        if (!this.templates.has(label)) {
            this.templates.set(label, []);
        }
        this.templates.get(label).push(template);
    }
    
    /**
     * 批量添加模板
     * 
     * @param {Array<{imageData: ImageData, label: string}>} samples - 样本数组
     */
    addTemplatesFromImages(samples) {
        for (const sample of samples) {
            this.addTemplateFromImage(sample.imageData, sample.label);
        }
    }
    
    /**
     * 获取模板库统计信息
     * 
     * @returns {object} 统计信息
     */
    getStats() {
        const stats = {
            totalTemplates: 0,
            numClasses: this.templates.size,
            classDistribution: {}
        };
        
        for (const [label, templates] of this.templates) {
            stats.classDistribution[label] = templates.length;
            stats.totalTemplates += templates.length;
        }
        
        return stats;
    }
    
    /**
     * 识别字符（从特征向量）
     * 
     * @param {number[]} features - 输入特征向量
     * @returns {object} 识别结果
     */
    recognize(features) {
        if (this.templates.size === 0) {
            return {
                label: null,
                distance: Infinity,
                confidence: 0,
                rejected: true,
                reason: '模板库为空'
            };
        }
        
        // 匹配所有模板
        const results = matchTemplate(features, this.templates, {
            metric: this.options.distanceMetric,
            aggregation: this.options.aggregation
        });
        
        // 计算置信度
        const withConfidence = calculateConfidence(results);
        
        const bestMatch = withConfidence[0];
        
        // 检查是否超过拒绝阈值
        if (this.options.rejectThreshold !== null && 
            bestMatch.distance > this.options.rejectThreshold) {
            return {
                label: null,
                distance: bestMatch.distance,
                confidence: bestMatch.confidence,
                rejected: true,
                reason: '超过拒绝阈值',
                candidates: withConfidence.slice(0, 5)
            };
        }
        
        return {
            label: bestMatch.label,
            distance: bestMatch.distance,
            confidence: bestMatch.confidence,
            rejected: false,
            candidates: withConfidence.slice(0, 5)
        };
    }
    
    /**
     * 识别字符（从图像）
     * 
     * @param {ImageData} imageData - 输入图像
     * @returns {object} 识别结果
     */
    recognizeFromImage(imageData) {
        if (extractStatisticalFeatures(imageData).foregroundCount === 0) {
            return { label: null, distance: Infinity, confidence: 0, rejected: true, reason: '图像没有前景字符', candidates: [] };
        }
        // 创建临时模板以提取特征
        const temp = createTemplate(imageData, '', {
            targetSize: this.options.imageSize,
            featureType: this.options.featureType,
            padding: this.options.padding
        });
        
        return this.recognize(temp.features);
    }
    
    /**
     * 批量识别
     * 
     * @param {ImageData[]} images - 图像数组
     * @returns {object[]} 识别结果数组
     */
    recognizeBatch(images) {
        return images.map(img => this.recognizeFromImage(img));
    }
    
    /**
     * 清空模板库
     */
    clear() {
        this.templates.clear();
    }
    
    /**
     * 删除指定类别的模板
     * 
     * @param {string} label - 类别标签
     */
    removeClass(label) {
        this.templates.delete(label);
    }
    
    /**
     * 导出模板库（用于保存）
     * 
     * @returns {object} 可序列化的模板库
     */
    export() {
        const data = {
            options: this.options,
            templates: {}
        };
        
        for (const [label, templates] of this.templates) {
            data.templates[label] = templates.map(t => ({
                label: t.label,
                features: Array.from(t.features),
                featureType: t.featureType
            }));
        }
        
        return data;
    }
    
    /**
     * 导入模板库（用于加载）
     * 
     * @param {object} data - 序列化的模板库
     */
    import(data) {
        this.options = { ...this.options, ...data.options };
        this.templates.clear();
        
        for (const [label, templates] of Object.entries(data.templates)) {
            this.templates.set(label, templates.map(t => ({
                label: t.label,
                features: t.features,
                featureType: t.featureType
            })));
        }
    }
}

// ==================== 便捷函数 ====================

/**
 * 识别单个字符（便捷函数）
 * 
 * @param {ImageData} imageData - 输入图像
 * @param {TemplateMatcher} matcher - 模板匹配器
 * @returns {object} 识别结果
 */
function recognizeCharacter(imageData, matcher) {
    return matcher.recognizeFromImage(imageData);
}

/**
 * 创建空数字匹配器（调用者需要提供模板）
 * 
 * 原理说明：
 * 本函数仅创建配置好的空匹配器，不生成数字；用 addTemplatesFromImages 添加样本。
 * 
 * @param {object} options - 配置选项
 * @returns {TemplateMatcher} 空模板匹配器
 */
function createDigitMatcher(options = {}) {
    const matcher = new TemplateMatcher(options);
    
    // 这个函数需要在浏览器或有 Canvas 的环境中使用
    // 这里只返回一个空的匹配器，实际模板需要从外部添加
    
    return matcher;
}

/**
 * 评估模板匹配器的准确率
 * 
 * @param {TemplateMatcher} matcher - 模板匹配器
 * @param {Array<{imageData: ImageData, label: string}>} testSet - 测试集
 * @returns {object} 评估结果
 */
function evaluateMatcher(matcher, testSet) {
    let correct = 0;
    let rejected = 0;
    const confusionMatrix = {};
    const errors = [];
    
    for (const sample of testSet) {
        const result = matcher.recognizeFromImage(sample.imageData);
        
        if (result.rejected) {
            rejected++;
            errors.push({
                actual: sample.label,
                predicted: null,
                type: 'rejected'
            });
        } else if (result.label === sample.label) {
            correct++;
        } else {
            errors.push({
                actual: sample.label,
                predicted: result.label,
                type: 'misclassified'
            });
        }
        
        // 更新混淆矩阵
        const actual = sample.label;
        const predicted = result.rejected ? 'REJECTED' : result.label;
        
        if (!confusionMatrix[actual]) {
            confusionMatrix[actual] = {};
        }
        confusionMatrix[actual][predicted] = 
            (confusionMatrix[actual][predicted] || 0) + 1;
    }
    
    return {
        total: testSet.length,
        correct,
        rejected,
        errors: errors.length,
        accuracy: testSet.length > 0 ? correct / testSet.length : 0,
        confusionMatrix,
        errorDetails: errors
    };
}

// 导出所有函数
return {
    // 相似度度量
    normalizedCrossCorrelation,
    calculateDistance,
    
    // 模板创建
    createTemplate,
    buildTemplateLibrary,
    
    // 模板匹配
    matchTemplate,
    calculateConfidence,
    
    // 模板匹配器类
    TemplateMatcher,
    
    // 便捷函数
    recognizeCharacter,
    createDigitMatcher,
    evaluateMatcher
};

});
