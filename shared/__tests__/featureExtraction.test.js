/**
 * 特征提取模块单元测试
 * 
 * 测试第 11 章的特征提取函数
 */

const {
    extractPixelFeatures,
    extractStatisticalFeatures,
    statisticalFeaturesToVector,
    calculateRawMoment,
    calculateCentralMoments,
    calculateHuMoments,
    logTransformHuMoments,
    extractProjectionFeatures,
    extractZoneFeatures,
    computeImageGradients,
    extractHOGFeatures,
    normalizeFeatures,
    resizeImage,
    getBoundingBox,
    cropAndCenter,
    extractCombinedFeatures,
    euclideanDistance,
    cosineSimilarity,
    manhattanDistance
} = require('../11-feature-extraction');

const { MockImageData } = require('../core');

// ==================== 测试辅助函数 ====================

/**
 * 创建简单的测试图像（黑色前景，白色背景）
 */
function createTestImage(width, height, foregroundPixels = []) {
    const imageData = new MockImageData(width, height);
    
    // 填充白色背景
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255;
        imageData.data[i + 1] = 255;
        imageData.data[i + 2] = 255;
        imageData.data[i + 3] = 255;
    }
    
    // 设置前景像素（黑色）
    for (const [x, y] of foregroundPixels) {
        const idx = (y * width + x) * 4;
        imageData.data[idx] = 0;
        imageData.data[idx + 1] = 0;
        imageData.data[idx + 2] = 0;
    }
    
    return imageData;
}

/**
 * 创建一个简单的十字形状
 */
function createCrossImage(size = 10) {
    const foreground = [];
    const center = Math.floor(size / 2);
    
    // 水平线
    for (let x = 1; x < size - 1; x++) {
        foreground.push([x, center]);
    }
    
    // 垂直线
    for (let y = 1; y < size - 1; y++) {
        if (y !== center) {
            foreground.push([center, y]);
        }
    }
    
    return createTestImage(size, size, foreground);
}

/**
 * 创建一个简单的方块形状
 */
function createSquareImage(size = 10, boxSize = 4) {
    const foreground = [];
    const start = Math.floor((size - boxSize) / 2);
    
    for (let y = start; y < start + boxSize; y++) {
        for (let x = start; x < start + boxSize; x++) {
            foreground.push([x, y]);
        }
    }
    
    return createTestImage(size, size, foreground);
}

// ==================== 像素特征测试 ====================

describe('extractPixelFeatures', () => {
    test('应该正确提取像素特征', () => {
        const image = createTestImage(4, 4, [[0, 0], [1, 1], [2, 2], [3, 3]]);
        const features = extractPixelFeatures(image, { normalize: true });
        
        expect(features).toHaveLength(16);
        expect(features[0]).toBeCloseTo(0); // 黑色像素
        expect(features[15]).toBeCloseTo(0); // 黑色像素
        expect(features[1]).toBeCloseTo(1); // 白色像素
    });
    
    test('二值模式应该返回 0 和 1', () => {
        const image = createTestImage(4, 4, [[0, 0], [1, 1]]);
        const features = extractPixelFeatures(image, { binary: true });
        
        expect(features[0]).toBe(1); // 黑色 = 前景 = 1
        expect(features[1]).toBe(0); // 白色 = 背景 = 0
    });
    
    test('不归一化应该返回原始像素值', () => {
        const image = createTestImage(2, 2, [[0, 0]]);
        const features = extractPixelFeatures(image, { normalize: false });
        
        expect(features[0]).toBe(0);
        expect(features[1]).toBe(255);
    });
});

// ==================== 统计特征测试 ====================

describe('extractStatisticalFeatures', () => {
    test('应该正确计算统计特征', () => {
        const image = createSquareImage(10, 4);
        const stats = extractStatisticalFeatures(image);
        
        expect(stats.fillRatio).toBeCloseTo(16 / 100);
        expect(stats.centroidX).toBeCloseTo(0.5, 1);
        expect(stats.centroidY).toBeCloseTo(0.5, 1);
        expect(stats.foregroundCount).toBe(16);
    });
    
    test('空白图像应该有正确的统计值', () => {
        const image = createTestImage(10, 10, []);
        const stats = extractStatisticalFeatures(image);
        
        expect(stats.fillRatio).toBe(0);
        expect(stats.mean).toBe(1); // 全白，归一化后为 1
    });
    
    test('全黑图像应该有正确的统计值', () => {
        const foreground = [];
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                foreground.push([x, y]);
            }
        }
        const image = createTestImage(10, 10, foreground);
        const stats = extractStatisticalFeatures(image);
        
        expect(stats.fillRatio).toBe(1);
        expect(stats.mean).toBe(0); // 全黑，归一化后为 0
    });
});

describe('statisticalFeaturesToVector', () => {
    test('应该返回正确长度的向量', () => {
        const stats = {
            mean: 0.5,
            variance: 0.25,
            stdDev: 0.5,
            fillRatio: 0.2,
            centroidX: 0.5,
            centroidY: 0.5
        };
        const vector = statisticalFeaturesToVector(stats);
        
        expect(vector).toHaveLength(6);
        expect(vector).toEqual([0.5, 0.25, 0.5, 0.2, 0.5, 0.5]);
    });
});

// ==================== 图像矩测试 ====================

describe('calculateRawMoment', () => {
    test('M00 应该等于前景像素数', () => {
        const image = createSquareImage(10, 4);
        const m00 = calculateRawMoment(image, 0, 0);
        
        expect(m00).toBe(16);
    });
    
    test('空白图像的矩应该为 0', () => {
        const image = createTestImage(10, 10, []);
        const m00 = calculateRawMoment(image, 0, 0);
        
        expect(m00).toBe(0);
    });
});

describe('calculateCentralMoments', () => {
    test('应该正确计算中心矩', () => {
        const image = createSquareImage(10, 4);
        const moments = calculateCentralMoments(image);
        
        expect(moments.m00).toBe(16);
        expect(moments.xBar).toBeCloseTo(4.5, 1);
        expect(moments.yBar).toBeCloseTo(4.5, 1);
    });
    
    test('一阶中心矩应该为 0', () => {
        const image = createSquareImage(10, 4);
        const moments = calculateCentralMoments(image);
        
        expect(moments.mu10).toBe(0);
        expect(moments.mu01).toBe(0);
    });
});

describe('calculateHuMoments', () => {
    test('应该返回 7 个 Hu 矩', () => {
        const image = createSquareImage(10, 4);
        const huMoments = calculateHuMoments(image);
        
        expect(huMoments).toHaveLength(7);
        huMoments.forEach(h => {
            expect(typeof h).toBe('number');
            expect(isNaN(h)).toBe(false);
        });
    });
    
    test('空白图像应该返回全零', () => {
        const image = createTestImage(10, 10, []);
        const huMoments = calculateHuMoments(image);
        
        expect(huMoments).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });
    
    test('相似形状应该有相似的 Hu 矩', () => {
        // 两个大小不同的正方形
        const square1 = createSquareImage(20, 4);
        const square2 = createSquareImage(20, 6);
        
        const hu1 = calculateHuMoments(square1);
        const hu2 = calculateHuMoments(square2);
        
        // 第一个 Hu 矩应该相对接近（都是正方形）
        // 由于尺度不同，会有一些差异
        expect(Math.abs(hu1[0] - hu2[0])).toBeLessThan(0.1);
    });
});

describe('logTransformHuMoments', () => {
    test('应该正确进行对数变换', () => {
        const huMoments = [0.1, 0.01, 0.001, -0.0001, 0.00001, -0.000001, 0];
        const logHu = logTransformHuMoments(huMoments);
        
        expect(logHu).toHaveLength(7);
        expect(logHu[6]).toBe(0); // 0 的对数变换结果为 0
    });
});

// ==================== 投影特征测试 ====================

describe('extractProjectionFeatures', () => {
    test('应该正确计算投影特征', () => {
        const image = createCrossImage(10);
        const projection = extractProjectionFeatures(image);
        
        expect(projection.horizontal).toHaveLength(10);
        expect(projection.vertical).toHaveLength(10);
        expect(projection.combined).toHaveLength(20);
    });
    
    test('十字形状的中心投影应该最大', () => {
        const image = createCrossImage(10);
        const projection = extractProjectionFeatures(image, { normalize: false });
        
        const center = 5;
        // 中心行有最多的前景像素（水平线）
        expect(projection.horizontal[center]).toBeGreaterThan(projection.horizontal[0]);
    });
    
    test('归一化后最大值应该为 1', () => {
        const image = createCrossImage(10);
        const projection = extractProjectionFeatures(image, { normalize: true });
        
        expect(Math.max(...projection.horizontal)).toBeCloseTo(1);
        expect(Math.max(...projection.vertical)).toBeCloseTo(1);
    });
});

// ==================== 网格特征测试 ====================

describe('extractZoneFeatures', () => {
    test('应该返回正确长度的特征', () => {
        const image = createSquareImage(16, 8);
        const features = extractZoneFeatures(image, 4);
        
        expect(features).toHaveLength(16);
    });
    
    test('特征值应该在 [0, 1] 范围内', () => {
        const image = createSquareImage(16, 8);
        const features = extractZoneFeatures(image, 4);
        
        features.forEach(f => {
            expect(f).toBeGreaterThanOrEqual(0);
            expect(f).toBeLessThanOrEqual(1);
        });
    });
    
    test('空白图像应该返回全零', () => {
        const image = createTestImage(16, 16, []);
        const features = extractZoneFeatures(image, 4);
        
        expect(features).toEqual(new Array(16).fill(0));
    });
});

// ==================== 梯度计算测试 ====================

describe('computeImageGradients', () => {
    test('应该返回正确尺寸的梯度数组', () => {
        const image = createSquareImage(10, 4);
        const gradients = computeImageGradients(image);
        
        expect(gradients.magnitude).toHaveLength(100);
        expect(gradients.direction).toHaveLength(100);
        expect(gradients.width).toBe(10);
        expect(gradients.height).toBe(10);
    });
    
    test('边界像素的梯度应该为 0', () => {
        const image = createSquareImage(10, 4);
        const gradients = computeImageGradients(image);
        
        // 第一行
        expect(gradients.magnitude[0]).toBe(0);
        expect(gradients.magnitude[9]).toBe(0);
    });
});

// ==================== HOG 特征测试 ====================

describe('extractHOGFeatures', () => {
    test('应该返回非空特征向量', () => {
        const image = createSquareImage(28, 10);
        const features = extractHOGFeatures(image, {
            cellSize: 7,
            blockSize: 2,
            numBins: 9
        });
        
        expect(features.length).toBeGreaterThan(0);
    });
    
    test('图像太小时应该返回空数组', () => {
        const image = createSquareImage(4, 2);
        const features = extractHOGFeatures(image, {
            cellSize: 8,
            blockSize: 2
        });
        
        expect(features).toEqual([]);
    });
    
    test('特征值应该是有效数字', () => {
        const image = createSquareImage(28, 10);
        const features = extractHOGFeatures(image);
        
        features.forEach(f => {
            expect(typeof f).toBe('number');
            expect(isNaN(f)).toBe(false);
            expect(isFinite(f)).toBe(true);
        });
    });
});

// ==================== 特征归一化测试 ====================

describe('normalizeFeatures', () => {
    test('L2 归一化后向量模长应该为 1', () => {
        const features = [3, 4, 0];
        const normalized = normalizeFeatures(features, 'l2');
        
        const norm = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
        expect(norm).toBeCloseTo(1);
    });
    
    test('Min-Max 归一化后值应该在 [0, 1] 范围', () => {
        const features = [0, 50, 100];
        const normalized = normalizeFeatures(features, 'minmax');
        
        expect(normalized[0]).toBe(0);
        expect(normalized[1]).toBe(0.5);
        expect(normalized[2]).toBe(1);
    });
    
    test('Z-Score 归一化后均值应该接近 0', () => {
        const features = [1, 2, 3, 4, 5];
        const normalized = normalizeFeatures(features, 'zscore');
        
        const mean = normalized.reduce((a, b) => a + b, 0) / normalized.length;
        expect(Math.abs(mean)).toBeLessThan(1e-10);
    });
    
    test('空数组应该返回空数组', () => {
        expect(normalizeFeatures([], 'l2')).toEqual([]);
    });
});

// ==================== 图像预处理测试 ====================

describe('resizeImage', () => {
    test('应该正确缩放图像尺寸', () => {
        const image = createSquareImage(20, 10);
        const resized = resizeImage(image, 10, 10);
        
        expect(resized.width).toBe(10);
        expect(resized.height).toBe(10);
    });
    
    test('放大图像也应该工作', () => {
        const image = createSquareImage(10, 4);
        const resized = resizeImage(image, 20, 20);
        
        expect(resized.width).toBe(20);
        expect(resized.height).toBe(20);
    });
});

describe('getBoundingBox', () => {
    test('应该返回正确的边界框', () => {
        const image = createSquareImage(10, 4);
        const bbox = getBoundingBox(image);
        
        expect(bbox.x).toBe(3);
        expect(bbox.y).toBe(3);
        expect(bbox.width).toBe(4);
        expect(bbox.height).toBe(4);
    });
    
    test('空白图像应该返回完整图像尺寸', () => {
        const image = createTestImage(10, 10, []);
        const bbox = getBoundingBox(image);
        
        expect(bbox.width).toBe(10);
        expect(bbox.height).toBe(10);
    });
});

describe('cropAndCenter', () => {
    test('应该返回正确尺寸的图像', () => {
        const image = createSquareImage(20, 8);
        const cropped = cropAndCenter(image, 28);
        
        expect(cropped.width).toBe(28);
        expect(cropped.height).toBe(28);
    });
});

// ==================== 组合特征测试 ====================

describe('extractCombinedFeatures', () => {
    test('应该返回组合特征', () => {
        const image = createSquareImage(28, 10);
        const features = extractCombinedFeatures(image);
        
        expect(features.all.length).toBeGreaterThan(0);
        expect(features.details).toHaveProperty('stats');
        expect(features.details).toHaveProperty('huMoments');
        expect(features.details).toHaveProperty('projection');
        expect(features.details).toHaveProperty('zone');
    });
    
    test('可以配置要提取的特征类型', () => {
        const image = createSquareImage(28, 10);
        
        // 只提取统计特征
        const features = extractCombinedFeatures(image, {
            includeStats: true,
            includeHuMoments: false,
            includeProjection: false,
            includeZone: false
        });
        
        expect(features.details.stats).toBeDefined();
        expect(features.details.huMoments).toBeUndefined();
    });
    
    test('包含 HOG 时应该有更多特征', () => {
        const image = createSquareImage(28, 10);
        
        const withoutHOG = extractCombinedFeatures(image, { includeHOG: false });
        const withHOG = extractCombinedFeatures(image, { includeHOG: true });
        
        expect(withHOG.all.length).toBeGreaterThan(withoutHOG.all.length);
    });
});

// ==================== 距离度量测试 ====================

describe('euclideanDistance', () => {
    test('应该正确计算欧氏距离', () => {
        const a = [0, 0];
        const b = [3, 4];
        
        expect(euclideanDistance(a, b)).toBe(5);
    });
    
    test('相同向量的距离应该为 0', () => {
        const a = [1, 2, 3];
        
        expect(euclideanDistance(a, a)).toBe(0);
    });
    
    test('长度不一致应该抛出错误', () => {
        const a = [1, 2];
        const b = [1, 2, 3];
        
        expect(() => euclideanDistance(a, b)).toThrow('向量长度不一致');
    });
});

describe('cosineSimilarity', () => {
    test('相同向量的相似度应该为 1', () => {
        const a = [1, 2, 3];
        
        expect(cosineSimilarity(a, a)).toBeCloseTo(1);
    });
    
    test('正交向量的相似度应该为 0', () => {
        const a = [1, 0];
        const b = [0, 1];
        
        expect(cosineSimilarity(a, b)).toBeCloseTo(0);
    });
    
    test('相反向量的相似度应该为 -1', () => {
        const a = [1, 0];
        const b = [-1, 0];
        
        expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
    });
});

describe('manhattanDistance', () => {
    test('应该正确计算曼哈顿距离', () => {
        const a = [0, 0];
        const b = [3, 4];
        
        expect(manhattanDistance(a, b)).toBe(7);
    });
    
    test('相同向量的距离应该为 0', () => {
        const a = [1, 2, 3];
        
        expect(manhattanDistance(a, a)).toBe(0);
    });
});
