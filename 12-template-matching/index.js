/**
 * 第 12 章：模板匹配 - Node.js 示例
 * 
 * 本示例演示如何使用模板匹配进行字符识别，
 * 这是最简单直观的 OCR 识别方法。
 * 
 * 运行方式：
 * cd 12-template-matching
 * node index.js
 */

// 导入模板匹配模块
const {
    normalizedCrossCorrelation,
    calculateDistance,
    createTemplate,
    buildTemplateLibrary,
    matchTemplate,
    calculateConfidence,
    TemplateMatcher,
    evaluateMatcher
} = require('../shared/12-template-matching');

// 导入核心工具
const { MockImageData } = require('../shared/core');

// ==================== 辅助函数 ====================

/**
 * 创建简单的数字图像（用于演示）
 */
function createDigitImage(digit, size = 28) {
    const imageData = new MockImageData(size, size);
    
    // 填充白色背景
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255;
        imageData.data[i + 1] = 255;
        imageData.data[i + 2] = 255;
        imageData.data[i + 3] = 255;
    }
    
    const setPixel = (x, y) => {
        if (x >= 0 && x < size && y >= 0 && y < size) {
            const idx = (y * size + x) * 4;
            imageData.data[idx] = 0;
            imageData.data[idx + 1] = 0;
            imageData.data[idx + 2] = 0;
        }
    };
    
    const center = Math.floor(size / 2);
    
    switch (digit) {
        case 0:
            // 椭圆形
            for (let angle = 0; angle < 360; angle += 5) {
                const rad = angle * Math.PI / 180;
                const x = Math.round(center + 8 * Math.cos(rad));
                const y = Math.round(center + 10 * Math.sin(rad));
                setPixel(x, y);
                setPixel(x + 1, y);
            }
            break;
            
        case 1:
            // 竖线
            for (let y = 4; y < 24; y++) {
                setPixel(center, y);
                setPixel(center + 1, y);
            }
            // 顶部小斜线
            setPixel(center - 2, 5);
            setPixel(center - 1, 4);
            break;
            
        case 2:
            // 2 的形状
            for (let x = center - 6; x <= center + 6; x++) {
                setPixel(x, 4);
                setPixel(x, 23);
            }
            for (let y = 4; y < 14; y++) {
                setPixel(center + 6, y);
            }
            for (let x = center - 6; x <= center + 6; x++) {
                setPixel(x, 13);
            }
            for (let y = 13; y < 24; y++) {
                setPixel(center - 6, y);
            }
            break;
            
        case 3:
            // 3 的形状
            for (let x = center - 5; x <= center + 5; x++) {
                setPixel(x, 4);
                setPixel(x, 13);
                setPixel(x, 23);
            }
            for (let y = 4; y < 24; y++) {
                setPixel(center + 5, y);
            }
            break;
            
        case 4:
            // 4 的形状
            for (let y = 4; y < 15; y++) {
                setPixel(center - 5, y);
            }
            for (let x = center - 5; x <= center + 5; x++) {
                setPixel(x, 14);
            }
            for (let y = 4; y < 24; y++) {
                setPixel(center + 3, y);
            }
            break;
            
        case 5:
            // 5 的形状
            for (let x = center - 6; x <= center + 6; x++) {
                setPixel(x, 4);
                setPixel(x, 13);
                setPixel(x, 23);
            }
            for (let y = 4; y < 14; y++) {
                setPixel(center - 6, y);
            }
            for (let y = 13; y < 24; y++) {
                setPixel(center + 6, y);
            }
            break;
            
        case 6:
            // 6 的形状
            for (let y = 4; y < 24; y++) {
                setPixel(center - 6, y);
            }
            for (let x = center - 6; x <= center + 6; x++) {
                setPixel(x, 4);
                setPixel(x, 13);
                setPixel(x, 23);
            }
            for (let y = 13; y < 24; y++) {
                setPixel(center + 6, y);
            }
            break;
            
        case 7:
            // 7 的形状
            for (let x = 6; x < 22; x++) {
                setPixel(x, 4);
                setPixel(x, 5);
            }
            for (let y = 4; y < 24; y++) {
                const x = 21 - Math.floor((y - 4) * 0.5);
                setPixel(x, y);
                setPixel(x + 1, y);
            }
            break;
            
        case 8:
            // 8 的形状（两个圆）
            for (let angle = 0; angle < 360; angle += 10) {
                const rad = angle * Math.PI / 180;
                const x1 = Math.round(center + 5 * Math.cos(rad));
                const y1 = Math.round(8 + 4 * Math.sin(rad));
                setPixel(x1, y1);
                const x2 = Math.round(center + 6 * Math.cos(rad));
                const y2 = Math.round(19 + 5 * Math.sin(rad));
                setPixel(x2, y2);
            }
            break;
            
        case 9:
            // 9 的形状
            for (let y = 4; y < 24; y++) {
                setPixel(center + 6, y);
            }
            for (let x = center - 6; x <= center + 6; x++) {
                setPixel(x, 4);
                setPixel(x, 13);
            }
            for (let y = 4; y < 14; y++) {
                setPixel(center - 6, y);
            }
            break;
            
        default:
            // 默认十字形
            for (let i = 4; i < 24; i++) {
                setPixel(center, i);
                setPixel(i, center);
            }
    }
    
    return imageData;
}

/**
 * 添加噪声到图像
 */
function addNoise(imageData, intensity = 0.1) {
    const result = new MockImageData(imageData.width, imageData.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 255 * intensity;
        result.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
        result.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
        result.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
        result.data[i + 3] = imageData.data[i + 3];
    }
    
    return result;
}

/**
 * 打印图像到控制台
 */
function printImage(imageData, label = '') {
    const { width, height, data } = imageData;
    
    if (label) console.log(`\n${label}:`);
    
    let output = '';
    for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            row += data[idx] < 128 ? '█' : ' ';
        }
        output += row + '\n';
    }
    console.log(output);
}

// ==================== 主程序 ====================

console.log('='.repeat(60));
console.log('第 12 章：模板匹配');
console.log('='.repeat(60));

// ==================== 1. 相似度度量演示 ====================

console.log('\n' + '='.repeat(60));
console.log('1. 相似度度量方法');
console.log('='.repeat(60));

const vectorA = [1, 2, 3, 4, 5];
const vectorB = [1.1, 2.1, 3.1, 4.1, 5.1];  // 相似
const vectorC = [5, 4, 3, 2, 1];             // 反向
const vectorD = [10, 20, 30, 40, 50];        // 比例缩放

console.log('\n测试向量:');
console.log(`  A = [${vectorA.join(', ')}]`);
console.log(`  B = [${vectorB.join(', ')}]  (与 A 相似)`);
console.log(`  C = [${vectorC.join(', ')}]  (与 A 反向)`);
console.log(`  D = [${vectorD.join(', ')}] (与 A 成比例)`);

console.log('\n欧氏距离（越小越相似）:');
console.log(`  d(A, B) = ${calculateDistance(vectorA, vectorB, 'euclidean').toFixed(4)}`);
console.log(`  d(A, C) = ${calculateDistance(vectorA, vectorC, 'euclidean').toFixed(4)}`);
console.log(`  d(A, D) = ${calculateDistance(vectorA, vectorD, 'euclidean').toFixed(4)}`);

console.log('\n余弦距离（越小越相似，0-2 范围）:');
console.log(`  d(A, B) = ${calculateDistance(vectorA, vectorB, 'cosine').toFixed(4)}`);
console.log(`  d(A, C) = ${calculateDistance(vectorA, vectorC, 'cosine').toFixed(4)}`);
console.log(`  d(A, D) = ${calculateDistance(vectorA, vectorD, 'cosine').toFixed(4)} (比例缩放，方向相同)`);

console.log('\n归一化相关系数（1 表示完全相关，-1 表示完全负相关）:');
console.log(`  NCC(A, B) = ${normalizedCrossCorrelation(vectorA, vectorB).toFixed(4)}`);
console.log(`  NCC(A, C) = ${normalizedCrossCorrelation(vectorA, vectorC).toFixed(4)}`);
console.log(`  NCC(A, D) = ${normalizedCrossCorrelation(vectorA, vectorD).toFixed(4)}`);

// ==================== 2. 构建模板库 ====================

console.log('\n' + '='.repeat(60));
console.log('2. 构建模板库');
console.log('='.repeat(60));

const matcher = new TemplateMatcher({
    featureType: 'combined',
    distanceMetric: 'euclidean',
    rejectThreshold: null  // 暂不设置拒绝阈值
});

// 添加数字 0-9 的模板
console.log('\n创建数字 0-9 的模板...');
for (let d = 0; d <= 9; d++) {
    const image = createDigitImage(d);
    matcher.addTemplateFromImage(image, d.toString());
}

const stats = matcher.getStats();
console.log(`\n模板库统计:`);
console.log(`  - 类别数量: ${stats.numClasses}`);
console.log(`  - 模板总数: ${stats.totalTemplates}`);
console.log(`  - 类别分布: ${JSON.stringify(stats.classDistribution)}`);

// 显示部分模板
printImage(createDigitImage(0), '模板 "0"');
printImage(createDigitImage(1), '模板 "1"');
printImage(createDigitImage(7), '模板 "7"');

// ==================== 3. 字符识别 ====================

console.log('\n' + '='.repeat(60));
console.log('3. 字符识别');
console.log('='.repeat(60));

// 测试识别
const testDigits = [0, 3, 7, 9];

console.log('\n识别结果:');
for (const d of testDigits) {
    const testImage = createDigitImage(d);
    const result = matcher.recognizeFromImage(testImage);
    
    console.log(`\n  测试数字 "${d}":`);
    console.log(`    - 识别结果: ${result.label}`);
    console.log(`    - 距离: ${result.distance.toFixed(4)}`);
    console.log(`    - 置信度: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`    - Top 3 候选: ${result.candidates.slice(0, 3).map(c => 
        `${c.label}(${(c.confidence * 100).toFixed(1)}%)`
    ).join(', ')}`);
}

// ==================== 4. 噪声影响 ====================

console.log('\n' + '='.repeat(60));
console.log('4. 噪声对识别的影响');
console.log('='.repeat(60));

const cleanImage = createDigitImage(5);
const noisyImage1 = addNoise(cleanImage, 0.1);
const noisyImage2 = addNoise(cleanImage, 0.3);
const noisyImage3 = addNoise(cleanImage, 0.5);

console.log('\n原始图像 vs 加噪图像:');
printImage(cleanImage, '原始 "5"');

const cleanResult = matcher.recognizeFromImage(cleanImage);
const noisy1Result = matcher.recognizeFromImage(noisyImage1);
const noisy2Result = matcher.recognizeFromImage(noisyImage2);
const noisy3Result = matcher.recognizeFromImage(noisyImage3);

console.log('噪声影响分析:');
console.log(`  原始图像: 识别为 "${cleanResult.label}", 置信度 ${(cleanResult.confidence * 100).toFixed(1)}%`);
console.log(`  10% 噪声: 识别为 "${noisy1Result.label}", 置信度 ${(noisy1Result.confidence * 100).toFixed(1)}%`);
console.log(`  30% 噪声: 识别为 "${noisy2Result.label}", 置信度 ${(noisy2Result.confidence * 100).toFixed(1)}%`);
console.log(`  50% 噪声: 识别为 "${noisy3Result.label}", 置信度 ${(noisy3Result.confidence * 100).toFixed(1)}%`);

// ==================== 5. 拒绝阈值 ====================

console.log('\n' + '='.repeat(60));
console.log('5. 拒绝阈值（识别未知字符）');
console.log('='.repeat(60));

// 创建一个带拒绝阈值的匹配器
const strictMatcher = new TemplateMatcher({
    featureType: 'combined',
    distanceMetric: 'euclidean',
    rejectThreshold: 5.0  // 设置较严格的阈值
});

// 只添加 0-4 的模板
for (let d = 0; d <= 4; d++) {
    strictMatcher.addTemplateFromImage(createDigitImage(d), d.toString());
}

console.log('\n模板库只包含 0-4，测试识别 0-9:');
for (let d = 0; d <= 9; d++) {
    const testImage = createDigitImage(d);
    const result = strictMatcher.recognizeFromImage(testImage);
    
    if (result.rejected) {
        console.log(`  数字 "${d}": ❌ 拒绝识别 (距离 ${result.distance.toFixed(2)} > 阈值 5.0)`);
    } else {
        console.log(`  数字 "${d}": ✓ 识别为 "${result.label}" (距离 ${result.distance.toFixed(2)})`);
    }
}

// ==================== 6. 不同距离度量比较 ====================

console.log('\n' + '='.repeat(60));
console.log('6. 不同距离度量方法比较');
console.log('='.repeat(60));

const metrics = ['euclidean', 'manhattan', 'cosine', 'correlation'];

// 测试图像：数字 8
const testImage8 = createDigitImage(8);

console.log('\n使用不同度量方法识别数字 "8":');

for (const metric of metrics) {
    const metricMatcher = new TemplateMatcher({
        featureType: 'combined',
        distanceMetric: metric
    });
    
    for (let d = 0; d <= 9; d++) {
        metricMatcher.addTemplateFromImage(createDigitImage(d), d.toString());
    }
    
    const result = metricMatcher.recognizeFromImage(testImage8);
    console.log(`  ${metric.padEnd(12)}: 识别为 "${result.label}", 置信度 ${(result.confidence * 100).toFixed(1)}%`);
}

// ==================== 7. 导出导入模板库 ====================

console.log('\n' + '='.repeat(60));
console.log('7. 导出和导入模板库');
console.log('='.repeat(60));

// 导出模板库
const exported = matcher.export();
console.log(`\n导出模板库:`);
console.log(`  - 选项: ${JSON.stringify(exported.options)}`);
console.log(`  - 类别数: ${Object.keys(exported.templates).length}`);

// 创建新匹配器并导入
const newMatcher = new TemplateMatcher();
newMatcher.import(exported);

console.log(`\n导入后验证:`);
const importStats = newMatcher.getStats();
console.log(`  - 类别数量: ${importStats.numClasses}`);
console.log(`  - 模板总数: ${importStats.totalTemplates}`);

// 验证识别能力
const verifyResult = newMatcher.recognizeFromImage(createDigitImage(3));
console.log(`  - 识别测试: 输入 "3" → 识别为 "${verifyResult.label}"`);

// ==================== 8. 模板匹配的局限性 ====================

console.log('\n' + '='.repeat(60));
console.log('8. 模板匹配的局限性');
console.log('='.repeat(60));

console.log(`
模板匹配适用于：
✓ 标准印刷体字符
✓ 字符类别有限且固定
✓ 输入质量较高

模板匹配的局限：
✗ 对旋转、倾斜敏感
✗ 对字体变化敏感
✗ 对手写体效果差
✗ 无法识别模板库外的字符
✗ 计算量随模板数量线性增长

下一步：
→ 第 13 章将学习 KNN 分类器
→ 通过多个最近邻投票决定类别
→ 更好地处理模板之间的变化
`);

// ==================== 总结 ====================

console.log('='.repeat(60));
console.log('总结');
console.log('='.repeat(60));

console.log(`
模板匹配是最简单直观的 OCR 识别方法：

1. 核心思想
   - 将待识别字符与预存模板逐一比较
   - 选择最相似的模板作为识别结果

2. 相似度度量
   - 欧氏距离：直观，对尺度敏感
   - 余弦相似度：只关注方向，对尺度不敏感
   - 相关系数：对亮度/对比度变化鲁棒

3. 关键步骤
   - 预处理：尺寸归一化、居中对齐
   - 特征提取：可使用像素、统计、投影等特征
   - 距离计算：选择合适的度量方法
   - 决策：最近邻 + 可选的拒绝阈值

4. 实际应用
   - 银行支票识别
   - OCR-A/OCR-B 字体识别
   - 车牌号识别（固定字体）
`);

console.log('='.repeat(60));
console.log('示例运行完成！');
console.log('='.repeat(60));
