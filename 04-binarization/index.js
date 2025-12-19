/**
 * 04. 二值化 (Binarization / Thresholding)
 * 
 * 本文件演示多种二值化算法，帮助你理解：
 * 1. 二值化的意义和作用
 * 2. 固定阈值二值化
 * 3. Otsu 自动阈值算法（重点）
 * 4. 自适应阈值算法
 * 
 * 前置知识：
 * - 01. 数字图像基础 ✅
 * - 02. JS图像处理基础 ✅
 * - 03. 灰度化 ✅
 * 
 * 运行方式：node index.js
 */

// 引入共享模块
const {
    MockImageData,
    getPixel,
    setPixel,
    cloneImageData,
    forEachPixel,
    forEachPixelXY,
    grayscaleWeighted,
    calculateHistogram,
    calculateHistogramStats
} = require('../shared/imageUtils');

// ==================== 二值化算法实现 ====================

/**
 * 固定阈值二值化
 * 
 * 原理说明：
 * - 使用一个固定的阈值分割图像
 * - 大于等于阈值的像素变为白色（255）
 * - 小于阈值的像素变为黑色（0）
 * 
 * @param {MockImageData} imageData - 灰度图像数据
 * @param {number} threshold - 阈值 (0-255)
 * @returns {MockImageData} 二值化后的图像数据
 */
function binarizeFixed(imageData, threshold) {
    return forEachPixel(imageData, (pixel) => {
        // 假设输入是灰度图，R=G=B
        const gray = pixel.r;
        const binary = gray >= threshold ? 255 : 0;
        return { r: binary, g: binary, b: binary };
    });
}

/**
 * 计算 Otsu 阈值
 * 
 * 原理说明：
 * - Otsu 算法基于类间方差最大化原理
 * - 遍历所有可能的阈值（0-255）
 * - 计算每个阈值对应的类间方差
 * - 选择使类间方差最大的阈值
 * 
 * 类间方差公式：
 * σ²(t) = w0(t) × w1(t) × [μ0(t) - μ1(t)]²
 * 
 * 其中：
 * - w0, w1 = 前景和背景的像素比例
 * - μ0, μ1 = 前景和背景的平均灰度值
 * 
 * @param {number[]} histogram - 灰度直方图（长度256）
 * @returns {{threshold: number, variance: number, w0: number, w1: number}} Otsu 结果
 */
function calculateOtsuThreshold(histogram) {
    // 计算总像素数
    const total = histogram.reduce((sum, count) => sum + count, 0);

    if (total === 0) {
        return { threshold: 128, variance: 0, w0: 0, w1: 0 };
    }

    // 计算灰度值总和（用于快速计算均值）
    let sum = 0;
    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
    }

    // 遍历所有可能的阈值
    let sumB = 0;      // 前景灰度值累计
    let wB = 0;        // 前景像素数
    let maxVariance = 0;
    let bestThreshold = 0;
    let bestW0 = 0;    // ✅ 记录最佳阈值时的前景像素数

    for (let t = 0; t < 256; t++) {
        wB += histogram[t];           // 前景权重（像素数）
        if (wB === 0) continue;       // 跳过空的前景

        const wF = total - wB;        // 背景权重
        if (wF === 0) break;          // 没有背景了，结束

        sumB += t * histogram[t];     // 前景灰度值累计

        const mB = sumB / wB;                 // 前景均值
        const mF = (sum - sumB) / wF;         // 背景均值

        // 类间方差
        const variance = wB * wF * (mB - mF) * (mB - mF);

        // 记录最大方差对应的阈值
        if (variance > maxVariance) {
            maxVariance = variance;
            bestThreshold = t;
            bestW0 = wB;              // ✅ 同时记录此时的前景像素数
        }
    }

    return {
        threshold: bestThreshold,
        variance: maxVariance,
        w0: bestW0,              // ✅ 使用最佳阈值时记录的值
        w1: total - bestW0       // ✅ 背景像素数
    };
}

/**
 * Otsu 二值化
 * 
 * 原理说明：
 * - 先计算灰度直方图
 * - 使用 Otsu 算法自动确定阈值
 * - 应用该阈值进行二值化
 * 
 * @param {MockImageData} imageData - 灰度图像数据
 * @returns {{imageData: MockImageData, threshold: number, variance: number}} 结果
 */
function binarizeOtsu(imageData) {
    // 计算直方图
    const histogram = calculateHistogram(imageData);
    
    // 计算 Otsu 阈值
    const otsuResult = calculateOtsuThreshold(histogram);
    
    // 应用阈值进行二值化
    const binaryImage = binarizeFixed(imageData, otsuResult.threshold);
    
    return {
        imageData: binaryImage,
        threshold: otsuResult.threshold,
        variance: otsuResult.variance
    };
}

/**
 * 自适应阈值二值化
 * 
 * 原理说明：
 * - 每个像素的阈值根据其局部邻域动态计算
 * - 阈值 = 邻域均值 - 常数C
 * - 适合处理光照不均匀的图像
 * 
 * @param {MockImageData} imageData - 灰度图像数据
 * @param {number} blockSize - 邻域大小（奇数）
 * @param {number} C - 从均值减去的常数
 * @returns {MockImageData} 二值化后的图像数据
 */
function binarizeAdaptive(imageData, blockSize = 15, C = 5) {
    const { width, height } = imageData;
    const result = cloneImageData(imageData);
    const halfBlock = Math.floor(blockSize / 2);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // 计算邻域均值
            let sum = 0;
            let count = 0;
            
            for (let dy = -halfBlock; dy <= halfBlock; dy++) {
                for (let dx = -halfBlock; dx <= halfBlock; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const pixel = getPixel(imageData, nx, ny);
                        sum += pixel.r;
                        count++;
                    }
                }
            }
            
            const mean = sum / count;
            const threshold = mean - C;
            
            // 获取当前像素并二值化
            const currentPixel = getPixel(imageData, x, y);
            const binary = currentPixel.r >= threshold ? 255 : 0;
            
            setPixel(result, x, y, binary, binary, binary);
        }
    }
    
    return result;
}

// ==================== 演示函数 ====================

/**
 * 演示 1：为什么要二值化
 */
function demonstrateWhyBinarize() {
    console.log('\n' + '='.repeat(60));
    console.log('📖 演示 1：为什么要二值化？');
    console.log('='.repeat(60));
    
    console.log(`
【二值化的意义】

二值化是 OCR 预处理的关键步骤：

1. 【简化数据】
   - 灰度图：256 个灰度级（8-bit）
   - 二值图：2 个灰度级（1-bit）
   - 数据量减少 8 倍！

2. 【分离前景和背景】
   - 文字（前景）→ 黑色 (0)
   - 背景 → 白色 (255)
   - 明确区分便于后续处理

3. 【减少噪声影响】
   - 中间灰度级的噪声被消除
   - 只保留明确的黑白信息

4. 【便于后续算法】
   - 连通域分析需要二值图
   - 形态学操作需要二值图
   - 轮廓检测需要二值图

【OCR 预处理流水线】

┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ 彩色图 │ → │ 灰度图 │ → │ 二值图 │ → │ 去噪  │ → ...
└────────┘   └────────┘   └────────┘   └────────┘
                            ↑ 当前学习
`);
}

/**
 * 演示 2：固定阈值二值化
 */
function demonstrateFixedThreshold() {
    console.log('\n' + '='.repeat(60));
    console.log('🔢 演示 2：固定阈值二值化');
    console.log('='.repeat(60));
    
    console.log(`
【固定阈值原理】

使用一个固定的值作为分界点：

if (grayValue >= threshold)
    pixel = 255 (白色)
else
    pixel = 0   (黑色)

【阈值选择的影响】

阈值过高 → 文字变细甚至断裂
阈值过低 → 文字变粗，背景噪声增多
`);
    
    // 创建测试图像
    const imageData = new MockImageData(5, 3);
    const grayValues = [
        30, 50, 100, 150, 200,
        40, 60, 128, 180, 220,
        20, 80, 127, 160, 240
    ];
    
    // 设置灰度值
    let i = 0;
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 5; x++) {
            const gray = grayValues[i++];
            setPixel(imageData, x, y, gray, gray, gray);
        }
    }
    
    console.log('【测试图像（5×3 灰度图）】\n');
    console.log('原始灰度值：');
    for (let y = 0; y < 3; y++) {
        let row = '  ';
        for (let x = 0; x < 5; x++) {
            const pixel = getPixel(imageData, x, y);
            row += String(pixel.r).padStart(4);
        }
        console.log(row);
    }
    
    // 测试不同阈值
    const thresholds = [80, 128, 180];
    
    thresholds.forEach(t => {
        const binary = binarizeFixed(imageData, t);
        console.log(`\n阈值 = ${t} 的二值化结果：`);
        for (let y = 0; y < 3; y++) {
            let row = '  ';
            for (let x = 0; x < 5; x++) {
                const pixel = getPixel(binary, x, y);
                row += pixel.r === 255 ? '  □ ' : '  ■ ';
            }
            console.log(row);
        }
    });
}

/**
 * 演示 3：Otsu 算法详解
 */
function demonstrateOtsu() {
    console.log('\n' + '='.repeat(60));
    console.log('⭐ 演示 3：Otsu 算法（大津算法）');
    console.log('='.repeat(60));
    
    console.log(`
【Otsu 算法核心思想】

寻找一个阈值 t，使得前景和背景的"类间方差"最大。
类间方差越大，说明前景和背景分离得越好。

【类间方差公式】

σ²(t) = w0(t) × w1(t) × [μ0(t) - μ1(t)]²

其中：
- w0 = 前景像素数 / 总像素数（前景权重）
- w1 = 背景像素数 / 总像素数（背景权重）
- μ0 = 前景像素的平均灰度值
- μ1 = 背景像素的平均灰度值

【算法步骤】

1. 计算灰度直方图
2. 遍历所有可能的阈值（0-255）
3. 对每个阈值计算类间方差
4. 选择使类间方差最大的阈值
`);
    
    // 模拟一个双峰分布的直方图
    const histogram = new Array(256).fill(0);
    
    // 创建双峰分布
    // 峰1：文字区域（暗，灰度值集中在 30-70）
    for (let i = 30; i <= 70; i++) {
        histogram[i] = Math.round(100 * Math.exp(-0.5 * Math.pow((i - 50) / 10, 2)));
    }
    // 峰2：背景区域（亮，灰度值集中在 180-220）
    for (let i = 180; i <= 220; i++) {
        histogram[i] = Math.round(150 * Math.exp(-0.5 * Math.pow((i - 200) / 10, 2)));
    }
    
    console.log('\n【模拟双峰直方图】');
    console.log('  峰1（文字区域）：灰度值 30-70，中心 50');
    console.log('  峰2（背景区域）：灰度值 180-220，中心 200');
    
    // 可视化直方图的两个峰
    console.log('\n直方图可视化（简化）：\n');
    console.log('频率');
    console.log('  │      ▓▓                              ▓▓▓');
    console.log('  │     ▓▓▓▓                            ▓▓▓▓▓');
    console.log('  │    ▓▓▓▓▓▓                          ▓▓▓▓▓▓▓');
    console.log('  └────────────────────────────────────────────── 灰度值');
    console.log('        50                   ↑            200');
    console.log('                         Otsu阈值');
    
    // 计算 Otsu 阈值
    const result = calculateOtsuThreshold(histogram);
    const total = histogram.reduce((a, b) => a + b, 0);
    
    console.log('\n【Otsu 计算结果】\n');
    console.log(`  最佳阈值: ${result.threshold}`);
    console.log(`  类间方差: ${result.variance.toFixed(2)}`);
    console.log(`  前景像素比例: ${((result.w0 / total) * 100).toFixed(1)}%`);
    console.log(`  背景像素比例: ${((result.w1 / total) * 100).toFixed(1)}%`);
    
    console.log(`

【Otsu 算法的优势】

1. 全自动：无需手动调整阈值
2. 效果好：基于统计学原理，通常能找到较优解
3. 快速：只需遍历 256 个可能的阈值

【Otsu 算法的局限】

1. 假设直方图是双峰分布
2. 对光照不均匀的图像效果不佳
3. 全局阈值，不能处理局部差异
`);
}

/**
 * 演示 4：自适应阈值
 */
function demonstrateAdaptiveThreshold() {
    console.log('\n' + '='.repeat(60));
    console.log('🔧 演示 4：自适应阈值');
    console.log('='.repeat(60));
    
    console.log(`
【自适应阈值原理】

每个像素的阈值根据其局部邻域动态计算：

threshold(x, y) = mean(邻域) - C

其中：
- 邻域：以 (x, y) 为中心的 blockSize × blockSize 区域
- mean：邻域内所有像素的平均灰度值
- C：常数，用于调整敏感度

【适用场景】

1. 光照不均匀的图像
2. 有渐变背景的文档
3. 阴影覆盖的文字

【与全局阈值的对比】

全局阈值（固定/Otsu）：
┌──────────────────────────────┐
│ 整张图使用同一个阈值        │
│ 光照不均时效果差            │
└──────────────────────────────┘

自适应阈值：
┌──────────────────────────────┐
│ 每个像素有自己的阈值        │
│ 能处理局部光照差异          │
└──────────────────────────────┘
`);
    
    // 演示参数影响
    console.log('【参数说明】\n');
    console.log('blockSize（邻域大小）：');
    console.log('  - 值越大，考虑的局部区域越大');
    console.log('  - 太小：容易受噪声影响');
    console.log('  - 太大：失去局部适应性');
    console.log('  - 推荐：11-31 之间的奇数\n');
    
    console.log('C（常数）：');
    console.log('  - 正值：阈值降低，更多像素变白');
    console.log('  - 负值：阈值升高，更多像素变黑');
    console.log('  - 推荐：2-10 之间');
}

/**
 * 演示 5：完整的二值化流程
 */
function demonstrateFullProcess() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 演示 5：完整的二值化流程');
    console.log('='.repeat(60));
    
    // 创建一个模拟文档图像
    // 深色代表文字，浅色代表背景
    const imageData = new MockImageData(8, 5);
    
    // 模拟 "HI" 文字的简化版本
    const pattern = [
        // 第1行
        [200, 200, 30, 200, 30, 200, 200, 200],
        // 第2行
        [200, 200, 30, 200, 30, 200, 200, 200],
        // 第3行
        [200, 200, 30, 30, 30, 200, 200, 200],
        // 第4行
        [200, 200, 30, 200, 30, 200, 200, 200],
        // 第5行
        [200, 200, 30, 200, 30, 200, 200, 200]
    ];
    
    // 设置像素
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 8; x++) {
            const gray = pattern[y][x];
            setPixel(imageData, x, y, gray, gray, gray);
        }
    }
    
    console.log('\n【模拟灰度图像（简化的 "H" 字母）】\n');
    console.log('灰度值（30=深色/文字，200=浅色/背景）：');
    
    for (let y = 0; y < 5; y++) {
        let row = '  ';
        for (let x = 0; x < 8; x++) {
            const pixel = getPixel(imageData, x, y);
            row += String(pixel.r).padStart(4);
        }
        console.log(row);
    }
    
    // 计算直方图和 Otsu 阈值
    const histogram = calculateHistogram(imageData);
    const otsuResult = binarizeOtsu(imageData);
    
    console.log(`\n【Otsu 阈值计算】`);
    console.log(`  自动计算的阈值: ${otsuResult.threshold}`);
    
    console.log('\n【二值化结果】\n');
    console.log('  ■ = 黑色(0) = 文字');
    console.log('  □ = 白色(255) = 背景\n');
    
    for (let y = 0; y < 5; y++) {
        let row = '  ';
        for (let x = 0; x < 8; x++) {
            const pixel = getPixel(otsuResult.imageData, x, y);
            row += pixel.r === 0 ? '  ■ ' : '  □ ';
        }
        console.log(row);
    }
    
    console.log('\n文字 "H" 已被成功提取！');
}

/**
 * 演示阈值选择对比
 */
function demonstrateThresholdComparison() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 演示 6：阈值选择对比');
    console.log('='.repeat(60));
    
    // 创建一个有噪声的图像
    const imageData = new MockImageData(10, 3);
    const grayValues = [
        // 第1行：背景（亮）+ 一些噪声
        180, 190, 185, 200, 195, 188, 192, 185, 190, 188,
        // 第2行：文字（暗）+ 一些噪声
        30, 45, 35, 50, 40, 38, 42, 35, 48, 32,
        // 第3行：混合区域
        100, 120, 90, 130, 110, 95, 125, 105, 115, 108
    ];
    
    let i = 0;
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 10; x++) {
            const gray = grayValues[i++];
            setPixel(imageData, x, y, gray, gray, gray);
        }
    }
    
    // 计算 Otsu 阈值
    const histogram = calculateHistogram(imageData);
    const otsuResult = calculateOtsuThreshold(histogram);
    
    console.log('\n【测试图像】');
    console.log('  行1: 背景区域 (灰度 ≈ 185-200)');
    console.log('  行2: 文字区域 (灰度 ≈ 30-50)');
    console.log('  行3: 混合区域 (灰度 ≈ 90-130)');
    console.log(`\n  Otsu 自动阈值: ${otsuResult.threshold}\n`);
    
    // 对比不同阈值的效果
    const thresholds = [80, otsuResult.threshold, 150];
    
    console.log('【不同阈值的二值化结果】\n');
    console.log('           阈值=80        阈值=' + otsuResult.threshold + '(Otsu)    阈值=150');
    console.log('          ──────────    ──────────    ──────────');
    
    for (let y = 0; y < 3; y++) {
        let row = `  行${y + 1}:   `;
        
        thresholds.forEach((t, idx) => {
            const binary = binarizeFixed(imageData, t);
            let part = '';
            for (let x = 0; x < 10; x++) {
                const pixel = getPixel(binary, x, y);
                part += pixel.r === 0 ? '■' : '□';
            }
            row += part + (idx < 2 ? '    ' : '');
        });
        
        console.log(row);
    }
    
    console.log(`

【分析】

阈值=80（过低）：
  - 第3行的混合区域都变成了背景（白）
  - 可能导致浅色文字丢失

阈值=${otsuResult.threshold}（Otsu）：
  - 自动找到合适的分界点
  - 文字和背景分离较好

阈值=150（过高）：
  - 第3行的混合区域都变成了前景（黑）
  - 可能导致噪声增多
`);
}

// ==================== 主程序 ====================

function main() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           04. 二值化 (Binarization / Thresholding)             ║');
    console.log('║                    OCR 学习项目 - 第四章                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n前置知识：01-03 章节 ✅\n');
    
    // 运行所有演示
    demonstrateWhyBinarize();
    demonstrateFixedThreshold();
    demonstrateOtsu();
    demonstrateAdaptiveThreshold();
    demonstrateFullProcess();
    demonstrateThresholdComparison();
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📚 本章总结');
    console.log('='.repeat(60));
    console.log(`
【核心知识点回顾】

1. 二值化将灰度图转为只有黑白两色的图像
2. 固定阈值简单但需要手动调整
3. Otsu 算法基于类间方差最大化，自动计算最佳阈值
4. 自适应阈值适合处理光照不均的图像

【三种二值化方法对比】

| 方法     | 优点           | 缺点                   |
|----------|----------------|------------------------|
| 固定阈值 | 简单快速       | 需手动调整，不够灵活   |
| Otsu     | 自动化，效果好 | 假设双峰分布           |
| 自适应   | 处理光照不均   | 计算量大，参数需调优   |

【可复用模块】

已添加到 shared/imageUtils.js：
- binarizeFixed(imageData, threshold) - 固定阈值
- binarizeOtsu(imageData) - Otsu 自动阈值
- calculateOtsuThreshold(histogram) - 计算 Otsu 阈值
- binarizeAdaptive(imageData, blockSize, C) - 自适应阈值

【下一步学习】

继续学习 05. 图像去噪，处理二值化后可能出现的噪点！
`);
}

// 运行主程序
main();

// ==================== 导出模块 ====================

module.exports = {
    binarizeFixed,
    binarizeOtsu,
    calculateOtsuThreshold,
    binarizeAdaptive
};
