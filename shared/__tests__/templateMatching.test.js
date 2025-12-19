/**
 * 模板匹配模块单元测试
 * 
 * 测试第 12 章的模板匹配函数
 */

const {
    normalizedCrossCorrelation,
    calculateDistance,
    createTemplate,
    buildTemplateLibrary,
    matchTemplate,
    calculateConfidence,
    TemplateMatcher
} = require('../12-template-matching');

const { MockImageData } = require('../core');

// ==================== 测试辅助函数 ====================

/**
 * 创建简单的测试图像
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
 * 创建一个简单的数字形状
 */
function createDigitImage(digit, size = 28) {
    const foreground = [];
    const center = Math.floor(size / 2);
    
    switch (digit) {
        case 0:
            // 椭圆形
            for (let angle = 0; angle < 360; angle += 10) {
                const rad = angle * Math.PI / 180;
                const x = Math.round(center + (size / 4) * Math.cos(rad));
                const y = Math.round(center + (size / 3) * Math.sin(rad));
                if (x >= 0 && x < size && y >= 0 && y < size) {
                    foreground.push([x, y]);
                }
            }
            break;
            
        case 1:
            // 竖线
            for (let y = 4; y < size - 4; y++) {
                foreground.push([center, y]);
                foreground.push([center + 1, y]);
            }
            break;
            
        case 7:
            // 7 形状
            for (let x = center - 5; x <= center + 5; x++) {
                foreground.push([x, 4]);
                foreground.push([x, 5]);
            }
            for (let y = 4; y < size - 4; y++) {
                const x = center + 5 - Math.floor((y - 4) * 0.3);
                foreground.push([x, y]);
            }
            break;
            
        default:
            // 默认十字形
            for (let i = 4; i < size - 4; i++) {
                foreground.push([center, i]);
                foreground.push([i, center]);
            }
    }
    
    return createTestImage(size, size, foreground);
}

// ==================== 相似度度量测试 ====================

describe('normalizedCrossCorrelation', () => {
    test('相同向量的相关系数应该为 1', () => {
        const a = [1, 2, 3, 4, 5];
        const result = normalizedCrossCorrelation(a, a);
        expect(result).toBeCloseTo(1);
    });
    
    test('完全负相关的向量应该接近 -1', () => {
        const a = [1, 2, 3, 4, 5];
        const b = [5, 4, 3, 2, 1];
        const result = normalizedCrossCorrelation(a, b);
        expect(result).toBeCloseTo(-1);
    });
    
    test('无相关的向量应该接近 0', () => {
        const a = [1, 0, -1, 0];
        const b = [0, 1, 0, -1];
        const result = normalizedCrossCorrelation(a, b);
        expect(Math.abs(result)).toBeLessThan(0.1);
    });
    
    test('常量向量应该处理正确', () => {
        const a = [5, 5, 5, 5];
        const b = [3, 3, 3, 3];
        const result = normalizedCrossCorrelation(a, b);
        // 两个常量向量，方差都为 0，应该返回 1
        expect(result).toBe(1);
    });
    
    test('长度不一致应该抛出错误', () => {
        expect(() => {
            normalizedCrossCorrelation([1, 2], [1, 2, 3]);
        }).toThrow('向量长度不一致');
    });
});

describe('calculateDistance', () => {
    test('欧氏距离应该正确计算', () => {
        const a = [0, 0];
        const b = [3, 4];
        expect(calculateDistance(a, b, 'euclidean')).toBe(5);
    });
    
    test('曼哈顿距离应该正确计算', () => {
        const a = [0, 0];
        const b = [3, 4];
        expect(calculateDistance(a, b, 'manhattan')).toBe(7);
    });
    
    test('余弦距离应该正确计算', () => {
        const a = [1, 0];
        const b = [1, 0];
        expect(calculateDistance(a, b, 'cosine')).toBeCloseTo(0);
        
        const c = [1, 0];
        const d = [0, 1];
        expect(calculateDistance(c, d, 'cosine')).toBeCloseTo(1);
    });
    
    test('相关距离应该正确计算', () => {
        const a = [1, 2, 3];
        expect(calculateDistance(a, a, 'correlation')).toBeCloseTo(0);
    });
    
    test('默认使用欧氏距离', () => {
        const a = [0, 0];
        const b = [3, 4];
        expect(calculateDistance(a, b)).toBe(5);
    });
});

// ==================== 模板创建测试 ====================

describe('createTemplate', () => {
    test('应该正确创建模板', () => {
        const image = createDigitImage(0);
        const template = createTemplate(image, '0');
        
        expect(template.label).toBe('0');
        expect(template.features).toBeDefined();
        expect(Array.isArray(template.features)).toBe(true);
        expect(template.features.length).toBeGreaterThan(0);
    });
    
    test('不同特征类型应该产生不同维度', () => {
        const image = createDigitImage(1);
        
        const pixelTemplate = createTemplate(image, '1', { featureType: 'pixel' });
        const zoneTemplate = createTemplate(image, '1', { featureType: 'zone' });
        
        // 像素特征 = 28*28 = 784
        expect(pixelTemplate.features.length).toBe(784);
        // 网格特征 = 4*4 = 16
        expect(zoneTemplate.features.length).toBe(16);
    });
    
    test('相同图像应该产生相同特征', () => {
        const image = createDigitImage(0);
        
        const template1 = createTemplate(image, '0');
        const template2 = createTemplate(image, '0');
        
        expect(template1.features).toEqual(template2.features);
    });
});

describe('buildTemplateLibrary', () => {
    test('应该正确构建模板库', () => {
        const samples = [
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' },
            { imageData: createDigitImage(0), label: '0' }
        ];
        
        const library = buildTemplateLibrary(samples);
        
        expect(library.size).toBe(2); // 2 个类别
        expect(library.get('0').length).toBe(2); // '0' 有 2 个模板
        expect(library.get('1').length).toBe(1); // '1' 有 1 个模板
    });
    
    test('空样本应该返回空库', () => {
        const library = buildTemplateLibrary([]);
        expect(library.size).toBe(0);
    });
});

// ==================== 模板匹配测试 ====================

describe('matchTemplate', () => {
    let library;
    
    beforeAll(() => {
        const samples = [
            { imageData: createDigitImage(0), label: '0' },
            { imageData: createDigitImage(1), label: '1' },
            { imageData: createDigitImage(7), label: '7' }
        ];
        library = buildTemplateLibrary(samples);
    });
    
    test('应该返回排序后的结果', () => {
        const testImage = createDigitImage(0);
        const template = createTemplate(testImage, 'test');
        
        const results = matchTemplate(template.features, library);
        
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(3);
        // 结果应该按距离排序
        for (let i = 1; i < results.length; i++) {
            expect(results[i].distance).toBeGreaterThanOrEqual(results[i-1].distance);
        }
    });
    
    test('相同图像的距离应该最小', () => {
        const testImage = createDigitImage(0);
        const template = createTemplate(testImage, 'test');
        
        const results = matchTemplate(template.features, library);
        
        // '0' 应该是最佳匹配
        expect(results[0].label).toBe('0');
        expect(results[0].distance).toBeCloseTo(0, 1);
    });
});

describe('calculateConfidence', () => {
    test('应该为每个结果添加置信度', () => {
        const results = [
            { label: '0', distance: 0.1 },
            { label: '1', distance: 0.5 },
            { label: '2', distance: 1.0 }
        ];
        
        const withConfidence = calculateConfidence(results);
        
        expect(withConfidence.length).toBe(3);
        withConfidence.forEach(r => {
            expect(r.confidence).toBeDefined();
            expect(r.confidence).toBeGreaterThanOrEqual(0);
            expect(r.confidence).toBeLessThanOrEqual(1);
        });
    });
    
    test('Softmax 置信度总和应该为 1', () => {
        const results = [
            { label: '0', distance: 0.1 },
            { label: '1', distance: 0.5 },
            { label: '2', distance: 1.0 }
        ];
        
        const withConfidence = calculateConfidence(results, { method: 'softmax' });
        const sum = withConfidence.reduce((s, r) => s + r.confidence, 0);
        
        expect(sum).toBeCloseTo(1);
    });
    
    test('距离最小的应该有最高置信度', () => {
        const results = [
            { label: '0', distance: 0.1 },
            { label: '1', distance: 0.5 }
        ];
        
        const withConfidence = calculateConfidence(results);
        
        expect(withConfidence[0].confidence).toBeGreaterThan(withConfidence[1].confidence);
    });
    
    test('空数组应该返回空数组', () => {
        expect(calculateConfidence([])).toEqual([]);
    });
});

// ==================== TemplateMatcher 类测试 ====================

describe('TemplateMatcher', () => {
    describe('基本操作', () => {
        test('应该能创建空的匹配器', () => {
            const matcher = new TemplateMatcher();
            const stats = matcher.getStats();
            
            expect(stats.totalTemplates).toBe(0);
            expect(stats.numClasses).toBe(0);
        });
        
        test('应该能添加模板', () => {
            const matcher = new TemplateMatcher();
            matcher.addTemplate('A', [1, 2, 3]);
            matcher.addTemplate('B', [4, 5, 6]);
            matcher.addTemplate('A', [7, 8, 9]);
            
            const stats = matcher.getStats();
            expect(stats.numClasses).toBe(2);
            expect(stats.classDistribution['A']).toBe(2);
            expect(stats.classDistribution['B']).toBe(1);
        });
        
        test('应该能从图像添加模板', () => {
            const matcher = new TemplateMatcher();
            const image = createDigitImage(0);
            
            matcher.addTemplateFromImage(image, '0');
            
            const stats = matcher.getStats();
            expect(stats.totalTemplates).toBe(1);
        });
        
        test('应该能清空模板库', () => {
            const matcher = new TemplateMatcher();
            matcher.addTemplate('A', [1, 2, 3]);
            matcher.clear();
            
            expect(matcher.getStats().totalTemplates).toBe(0);
        });
        
        test('应该能删除指定类别', () => {
            const matcher = new TemplateMatcher();
            matcher.addTemplate('A', [1, 2, 3]);
            matcher.addTemplate('B', [4, 5, 6]);
            matcher.removeClass('A');
            
            const stats = matcher.getStats();
            expect(stats.numClasses).toBe(1);
            expect(stats.classDistribution['A']).toBeUndefined();
        });
    });
    
    describe('识别功能', () => {
        let matcher;
        
        beforeAll(() => {
            matcher = new TemplateMatcher();
            matcher.addTemplateFromImage(createDigitImage(0), '0');
            matcher.addTemplateFromImage(createDigitImage(1), '1');
            matcher.addTemplateFromImage(createDigitImage(7), '7');
        });
        
        test('应该正确识别相同图像', () => {
            const testImage = createDigitImage(0);
            const result = matcher.recognizeFromImage(testImage);
            
            expect(result.label).toBe('0');
            expect(result.rejected).toBe(false);
            expect(result.confidence).toBeGreaterThan(0);
        });
        
        test('应该返回候选结果', () => {
            const testImage = createDigitImage(1);
            const result = matcher.recognizeFromImage(testImage);
            
            expect(result.candidates).toBeDefined();
            expect(result.candidates.length).toBeLessThanOrEqual(5);
        });
        
        test('空模板库应该拒绝识别', () => {
            const emptyMatcher = new TemplateMatcher();
            const result = emptyMatcher.recognize([1, 2, 3]);
            
            expect(result.rejected).toBe(true);
            expect(result.reason).toBe('模板库为空');
        });
    });
    
    describe('拒绝阈值', () => {
        test('超过阈值应该拒绝', () => {
            const matcher = new TemplateMatcher({ rejectThreshold: 0.01 });
            matcher.addTemplate('A', [0, 0, 0]);
            
            const result = matcher.recognize([100, 100, 100]);
            
            expect(result.rejected).toBe(true);
            expect(result.reason).toBe('超过拒绝阈值');
        });
        
        test('不设阈值时不拒绝', () => {
            const matcher = new TemplateMatcher({ rejectThreshold: null });
            matcher.addTemplate('A', [0, 0, 0]);
            
            const result = matcher.recognize([100, 100, 100]);
            
            expect(result.rejected).toBe(false);
        });
    });
    
    describe('导入导出', () => {
        test('应该能正确导出和导入', () => {
            const matcher1 = new TemplateMatcher();
            matcher1.addTemplate('A', [1, 2, 3]);
            matcher1.addTemplate('B', [4, 5, 6]);
            
            const exported = matcher1.export();
            
            const matcher2 = new TemplateMatcher();
            matcher2.import(exported);
            
            const stats1 = matcher1.getStats();
            const stats2 = matcher2.getStats();
            
            expect(stats2.numClasses).toBe(stats1.numClasses);
            expect(stats2.totalTemplates).toBe(stats1.totalTemplates);
        });
    });
    
    describe('批量识别', () => {
        test('应该能批量识别', () => {
            const matcher = new TemplateMatcher();
            matcher.addTemplateFromImage(createDigitImage(0), '0');
            matcher.addTemplateFromImage(createDigitImage(1), '1');
            
            const images = [
                createDigitImage(0),
                createDigitImage(1),
                createDigitImage(0)
            ];
            
            const results = matcher.recognizeBatch(images);
            
            expect(results.length).toBe(3);
            expect(results[0].label).toBe('0');
            expect(results[1].label).toBe('1');
            expect(results[2].label).toBe('0');
        });
    });
});

// ==================== 集成测试 ====================

describe('集成测试', () => {
    test('完整的识别流程', () => {
        // 1. 创建模板库
        const matcher = new TemplateMatcher({
            featureType: 'combined',
            distanceMetric: 'euclidean'
        });
        
        // 2. 添加模板
        for (let d = 0; d <= 9; d++) {
            const image = createDigitImage(d);
            matcher.addTemplateFromImage(image, d.toString());
        }
        
        // 3. 验证统计信息
        const stats = matcher.getStats();
        expect(stats.numClasses).toBeGreaterThan(0);
        
        // 4. 测试识别
        const testImage = createDigitImage(0);
        const result = matcher.recognizeFromImage(testImage);
        
        expect(result.rejected).toBe(false);
        expect(result.label).toBe('0');
        expect(result.confidence).toBeGreaterThan(0.5);
    });
});
