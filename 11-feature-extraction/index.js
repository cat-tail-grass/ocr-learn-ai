/**
 * 第 11 章：特征提取基础 - Node.js 示例
 * 
 * 本示例演示如何从字符图像中提取各种特征，
 * 这些特征将用于后续的模板匹配和 KNN 分类器。
 * 
 * 运行方式：
 * cd 11-feature-extraction
 * node index.js
 */

// 导入特征提取模块
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
    extractHOGFeatures,
    normalizeFeatures,
    extractCombinedFeatures,
    euclideanDistance,
    cosineSimilarity,
    resizeImage,
    cropAndCenter
} = require('../shared/11-feature-extraction');

// 导入核心工具
const { MockImageData } = require('../shared/core');

// ==================== 辅助函数 ====================

/**
 * 创建模拟的字符图像（用于演示）
 * 在实际应用中，这些图像来自文本区域定位模块的输出
 */
function createCharacterImage(char) {
    const size = 28; // 标准尺寸（类似 MNIST）
    const imageData = new MockImageData(size, size);
    
    // 填充白色背景
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 255;
        imageData.data[i + 1] = 255;
        imageData.data[i + 2] = 255;
        imageData.data[i + 3] = 255;
    }
    
    // 根据字符绘制简单的形状
    const setPixel = (x, y) => {
        if (x >= 0 && x < size && y >= 0 && y < size) {
            const idx = (y * size + x) * 4;
            imageData.data[idx] = 0;
            imageData.data[idx + 1] = 0;
            imageData.data[idx + 2] = 0;
        }
    };
    
    // 绘制简单的数字形状（粗略模拟）
    switch (char) {
        case '0':
            // 绘制椭圆形
            for (let angle = 0; angle < 360; angle += 5) {
                const rad = angle * Math.PI / 180;
                const x = Math.round(14 + 8 * Math.cos(rad));
                const y = Math.round(14 + 10 * Math.sin(rad));
                setPixel(x, y);
                setPixel(x + 1, y);
            }
            break;
            
        case '1':
            // 绘制竖线
            for (let y = 4; y < 24; y++) {
                setPixel(14, y);
                setPixel(15, y);
            }
            // 顶部小横线
            setPixel(12, 5);
            setPixel(13, 4);
            break;
            
        case '7':
            // 绘制 7
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
            
        case 'A':
            // 绘制 A
            // 左斜线
            for (let i = 0; i < 20; i++) {
                const x = 6 + Math.floor(i * 0.4);
                const y = 23 - i;
                setPixel(x, y);
                setPixel(x + 1, y);
            }
            // 右斜线
            for (let i = 0; i < 20; i++) {
                const x = 21 - Math.floor(i * 0.4);
                const y = 23 - i;
                setPixel(x, y);
                setPixel(x + 1, y);
            }
            // 横线
            for (let x = 10; x < 18; x++) {
                setPixel(x, 14);
            }
            break;
            
        case 'O':
            // 绘制圆形 O
            for (let angle = 0; angle < 360; angle += 3) {
                const rad = angle * Math.PI / 180;
                const x = Math.round(14 + 9 * Math.cos(rad));
                const y = Math.round(14 + 10 * Math.sin(rad));
                setPixel(x, y);
            }
            break;
            
        default:
            // 默认绘制一个十字
            for (let i = 4; i < 24; i++) {
                setPixel(14, i);
                setPixel(i, 14);
            }
    }
    
    return imageData;
}

/**
 * 打印图像到控制台（用于调试）
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

/**
 * 格式化数组输出
 */
function formatArray(arr, precision = 4) {
    return arr.map(v => v.toFixed(precision)).join(', ');
}

// ==================== 主程序 ====================

console.log('='.repeat(60));
console.log('第 11 章：特征提取基础');
console.log('='.repeat(60));

// 创建测试字符图像
const char0 = createCharacterImage('0');
const char1 = createCharacterImage('1');
const char7 = createCharacterImage('7');
const charA = createCharacterImage('A');
const charO = createCharacterImage('O');

// 打印字符图像
console.log('\n【生成的测试字符图像】');
printImage(char0, '字符 "0"');
printImage(char1, '字符 "1"');

// ==================== 1. 像素级特征 ====================

console.log('\n' + '='.repeat(60));
console.log('1. 像素级特征');
console.log('='.repeat(60));

const pixelFeatures0 = extractPixelFeatures(char0, { normalize: true });
const pixelFeatures1 = extractPixelFeatures(char1, { normalize: true });

console.log(`\n字符 "0" 像素特征维度: ${pixelFeatures0.length}`);
console.log(`字符 "1" 像素特征维度: ${pixelFeatures1.length}`);

// 计算两个字符的像素特征距离
const pixelDistance = euclideanDistance(pixelFeatures0, pixelFeatures1);
console.log(`\n"0" 和 "1" 的像素特征欧氏距离: ${pixelDistance.toFixed(4)}`);

// ==================== 2. 统计特征 ====================

console.log('\n' + '='.repeat(60));
console.log('2. 统计特征');
console.log('='.repeat(60));

const stats0 = extractStatisticalFeatures(char0);
const stats1 = extractStatisticalFeatures(char1);
const statsA = extractStatisticalFeatures(charA);

console.log('\n字符 "0" 的统计特征:');
console.log(`  - 归一化均值: ${stats0.mean.toFixed(4)}`);
console.log(`  - 归一化方差: ${stats0.variance.toFixed(6)}`);
console.log(`  - 填充率: ${stats0.fillRatio.toFixed(4)}`);
console.log(`  - 质心 X: ${stats0.centroidX.toFixed(4)}`);
console.log(`  - 质心 Y: ${stats0.centroidY.toFixed(4)}`);
console.log(`  - 前景像素数: ${stats0.foregroundCount}`);

console.log('\n字符 "1" 的统计特征:');
console.log(`  - 填充率: ${stats1.fillRatio.toFixed(4)}`);
console.log(`  - 质心 X: ${stats1.centroidX.toFixed(4)}`);
console.log(`  - 前景像素数: ${stats1.foregroundCount}`);

console.log('\n字符 "A" 的统计特征:');
console.log(`  - 填充率: ${statsA.fillRatio.toFixed(4)}`);
console.log(`  - 质心 Y: ${statsA.centroidY.toFixed(4)} (注意：A 的重心偏上)`);

// 转换为向量用于比较
const statsVector0 = statisticalFeaturesToVector(stats0);
const statsVector1 = statisticalFeaturesToVector(stats1);
console.log(`\n统计特征向量维度: ${statsVector0.length}`);

// ==================== 3. 图像矩与 Hu 矩 ====================

console.log('\n' + '='.repeat(60));
console.log('3. 图像矩与 Hu 矩（旋转不变）');
console.log('='.repeat(60));

// 计算原始矩
const m00_0 = calculateRawMoment(char0, 0, 0);
const m00_1 = calculateRawMoment(char1, 0, 0);
console.log(`\n原始矩 M00（面积）:`);
console.log(`  - 字符 "0": ${m00_0}`);
console.log(`  - 字符 "1": ${m00_1}`);

// 计算 Hu 矩
const hu0 = calculateHuMoments(char0);
const hu1 = calculateHuMoments(char1);
const huA = calculateHuMoments(charA);
const huO = calculateHuMoments(charO);

console.log(`\n字符 "0" 的 Hu 矩:`);
console.log(`  [${formatArray(hu0)}]`);

console.log(`\n字符 "1" 的 Hu 矩:`);
console.log(`  [${formatArray(hu1)}]`);

// 对数变换（压缩范围）
const logHu0 = logTransformHuMoments(hu0);
const logHu1 = logTransformHuMoments(hu1);
const logHuO = logTransformHuMoments(huO);

console.log(`\n对数变换后的 Hu 矩（更易比较）:`);
console.log(`  "0": [${formatArray(logHu0)}]`);
console.log(`  "O": [${formatArray(logHuO)}]`);

// 比较相似形状
const huDistance_0_O = euclideanDistance(logHu0, logHuO);
const huDistance_0_1 = euclideanDistance(logHu0, logHu1);
console.log(`\n"0" 和 "O" 的 Hu 矩距离: ${huDistance_0_O.toFixed(4)} (应该较小，形状相似)`);
console.log(`"0" 和 "1" 的 Hu 矩距离: ${huDistance_0_1.toFixed(4)} (应该较大，形状不同)`);

// ==================== 4. 投影特征 ====================

console.log('\n' + '='.repeat(60));
console.log('4. 投影特征');
console.log('='.repeat(60));

const projection0 = extractProjectionFeatures(char0);
const projection1 = extractProjectionFeatures(char1);

console.log(`\n投影特征维度: 水平 ${projection0.horizontal.length} + 垂直 ${projection0.vertical.length} = ${projection0.combined.length}`);

console.log(`\n字符 "0" 水平投影（前 10 个值）:`);
console.log(`  [${formatArray(projection0.horizontal.slice(0, 10))}...]`);

console.log(`\n字符 "1" 水平投影（前 10 个值）:`);
console.log(`  [${formatArray(projection1.horizontal.slice(0, 10))}...]`);

console.log(`\n注意：`);
console.log(`  - "0" 的水平投影两端小，中间大（椭圆形状）`);
console.log(`  - "1" 的垂直投影中间有明显峰值（竖线）`);

// ==================== 5. 网格特征 ====================

console.log('\n' + '='.repeat(60));
console.log('5. 网格（分区）特征');
console.log('='.repeat(60));

const zone0 = extractZoneFeatures(char0, 4);
const zone1 = extractZoneFeatures(char1, 4);

console.log(`\n4×4 网格特征维度: ${zone0.length}`);

console.log(`\n字符 "0" 的网格特征（4×4 = 16 个区域的填充率）:`);
// 打印为 4×4 矩阵
for (let row = 0; row < 4; row++) {
    const rowData = zone0.slice(row * 4, (row + 1) * 4);
    console.log(`  [${rowData.map(v => v.toFixed(3).padStart(5)).join(', ')}]`);
}

console.log(`\n字符 "1" 的网格特征:`);
for (let row = 0; row < 4; row++) {
    const rowData = zone1.slice(row * 4, (row + 1) * 4);
    console.log(`  [${rowData.map(v => v.toFixed(3).padStart(5)).join(', ')}]`);
}

// ==================== 6. HOG 特征 ====================

console.log('\n' + '='.repeat(60));
console.log('6. HOG 特征（方向梯度直方图）');
console.log('='.repeat(60));

const hogOptions = {
    cellSize: 7,    // 28 / 4 = 7，得到 4×4 个 Cell
    blockSize: 2,   // 2×2 Cell 组成 Block
    numBins: 9      // 9 个方向 bin
};

const hog0 = extractHOGFeatures(char0, hogOptions);
const hog1 = extractHOGFeatures(char1, hogOptions);

console.log(`\nHOG 参数:`);
console.log(`  - Cell 大小: ${hogOptions.cellSize}×${hogOptions.cellSize} 像素`);
console.log(`  - Block 大小: ${hogOptions.blockSize}×${hogOptions.blockSize} Cell`);
console.log(`  - 方向 bin 数: ${hogOptions.numBins}`);

console.log(`\nHOG 特征维度: ${hog0.length}`);
console.log(`  计算: (4-${hogOptions.blockSize}+1)² × ${hogOptions.blockSize}² × ${hogOptions.numBins} = ${Math.pow(4-hogOptions.blockSize+1, 2) * Math.pow(hogOptions.blockSize, 2) * hogOptions.numBins}`);

// 显示部分 HOG 特征
console.log(`\n字符 "0" HOG 特征（前 18 个值，即第一个 Block）:`);
console.log(`  [${formatArray(hog0.slice(0, 18))}...]`);

const hogDistance = euclideanDistance(hog0, hog1);
console.log(`\n"0" 和 "1" 的 HOG 特征距离: ${hogDistance.toFixed(4)}`);

// ==================== 7. 特征归一化 ====================

console.log('\n' + '='.repeat(60));
console.log('7. 特征归一化');
console.log('='.repeat(60));

const rawFeatures = [10, 50, 100, 200, 500];

console.log(`\n原始特征: [${rawFeatures.join(', ')}]`);

const l2Norm = normalizeFeatures(rawFeatures, 'l2');
console.log(`L2 归一化: [${formatArray(l2Norm)}]`);

const minmaxNorm = normalizeFeatures(rawFeatures, 'minmax');
console.log(`Min-Max 归一化: [${formatArray(minmaxNorm)}]`);

const zscoreNorm = normalizeFeatures(rawFeatures, 'zscore');
console.log(`Z-Score 标准化: [${formatArray(zscoreNorm)}]`);

// ==================== 8. 组合特征 ====================

console.log('\n' + '='.repeat(60));
console.log('8. 组合特征');
console.log('='.repeat(60));

const combined0 = extractCombinedFeatures(char0, {
    includePixels: false,
    includeStats: true,
    includeHuMoments: true,
    includeProjection: true,
    includeZone: true,
    includeHOG: true,
    hogOptions: hogOptions
});

const combined1 = extractCombinedFeatures(char1, {
    includePixels: false,
    includeStats: true,
    includeHuMoments: true,
    includeProjection: true,
    includeZone: true,
    includeHOG: true,
    hogOptions: hogOptions
});

console.log(`\n组合特征各部分维度:`);
console.log(`  - 统计特征: ${combined0.details.stats.length} 维`);
console.log(`  - Hu 矩: ${combined0.details.huMoments.length} 维`);
console.log(`  - 投影特征: ${combined0.details.projection.length} 维`);
console.log(`  - 网格特征: ${combined0.details.zone.length} 维`);
console.log(`  - HOG 特征: ${combined0.details.hog.length} 维`);
console.log(`  - 总维度: ${combined0.all.length} 维`);

// 计算组合特征的距离
const combinedDistance = euclideanDistance(combined0.all, combined1.all);
const combinedSimilarity = cosineSimilarity(combined0.all, combined1.all);

console.log(`\n"0" 和 "1" 的组合特征比较:`);
console.log(`  - 欧氏距离: ${combinedDistance.toFixed(4)}`);
console.log(`  - 余弦相似度: ${combinedSimilarity.toFixed(4)}`);

// ==================== 9. 特征匹配示例 ====================

console.log('\n' + '='.repeat(60));
console.log('9. 特征匹配示例');
console.log('='.repeat(60));

// 创建一个简单的"模板库"
const templates = [
    { label: '0', features: combined0.all },
    { label: '1', features: combined1.all }
];

// 创建一个测试字符（O，应该更接近 0）
const testChar = createCharacterImage('O');
const testFeatures = extractCombinedFeatures(testChar, {
    includePixels: false,
    includeStats: true,
    includeHuMoments: true,
    includeProjection: true,
    includeZone: true,
    includeHOG: true,
    hogOptions: hogOptions
});

console.log(`\n测试字符 "O" 与模板的距离:`);

templates.forEach(template => {
    const distance = euclideanDistance(testFeatures.all, template.features);
    const similarity = cosineSimilarity(testFeatures.all, template.features);
    console.log(`  - 与 "${template.label}": 距离=${distance.toFixed(4)}, 相似度=${similarity.toFixed(4)}`);
});

// 找到最匹配的模板
const distances = templates.map(t => ({
    label: t.label,
    distance: euclideanDistance(testFeatures.all, t.features)
}));
distances.sort((a, b) => a.distance - b.distance);

console.log(`\n匹配结果: "O" 最接近 "${distances[0].label}"`);
console.log(`（这是符合预期的，因为 O 和 0 形状相似）`);

// ==================== 总结 ====================

console.log('\n' + '='.repeat(60));
console.log('总结');
console.log('='.repeat(60));

console.log(`
特征提取是 OCR 识别的关键步骤：

1. 像素特征
   - 最简单直接，但维度高（28×28=784 维）
   - 对平移、旋转敏感
   
2. 统计特征
   - 维度低（6 维），计算快
   - 填充率可以区分"密"和"稀"的字符
   
3. Hu 矩
   - 只有 7 维，具有旋转不变性
   - 相似形状的 Hu 矩接近（如 0 和 O）
   
4. 投影特征
   - 捕获字符的轮廓形状
   - 维度中等（56 维）
   
5. 网格特征
   - 局部分布信息
   - 4×4 网格只有 16 维
   
6. HOG 特征
   - 最强大的特征，捕获边缘方向分布
   - 维度较高，但效果最好

下一步：
- 第 12 章将学习如何使用这些特征进行模板匹配
- 第 13 章将学习 KNN 分类器，利用特征进行字符识别
`);

console.log('='.repeat(60));
console.log('示例运行完成！');
console.log('='.repeat(60));
