/**
 * 03. 灰度化 (Grayscale Conversion)
 * 
 * 本文件演示多种灰度化算法，帮助你理解：
 * 1. 为什么要进行灰度化
 * 2. 不同灰度化算法的原理和差异
 * 3. 灰度直方图的计算和意义
 * 
 * 前置知识：
 * - 01. 数字图像基础（RGB、像素索引）✅
 * - 02. JS图像处理基础（Canvas API、像素遍历）✅
 * 
 * 运行方式：node index.js
 */

// 算法逐步实现位于 shared/03-grayscale，Node 与 HTML 调用同一份。
const { MockImageData, getPixel, setPixel, createImageData, rgbToGray } = require('../shared/core');
const {
    grayscaleWeighted, grayscaleAverage, grayscaleMax, grayscaleMin,
    grayscaleSingleChannel, grayscaleLuminosity, grayscaleLinearSrgb,
    calculateHistogram, calculateHistogramStats
} = require('../shared/03-grayscale');

// ==================== 演示函数 ====================

/**
 * 演示 1：为什么要灰度化
 */
function demonstrateWhyGrayscale() {
    console.log('\n' + '='.repeat(60));
    console.log('📖 演示 1：为什么要灰度化？');
    console.log('='.repeat(60));
    
    console.log(`
【灰度化的意义】

灰度化是 OCR 预处理的第一步，主要原因：

1. 【降低复杂度】
   - 彩色图：每像素 3 个通道（RGB）= 3 字节
   - 灰度图：每像素 1 个通道 = 1 字节
   - 上述紧凑存储才减少2/3；本项目RGBA存储不变

2. 【去除颜色干扰】
   - 很多OCR利用强度形状，颜色也可能是有用信息
   - 本加权法纯红为76、纯蓝为29；等灰度异色可能无法再区分
   - 简化了后续处理逻辑

3. 【为二值化做准备】
   - 二值化需要单通道输入
   - 灰度图是彩色图到二值图的桥梁

4. 【提高处理速度】
   - 算法只需处理一个通道
   - 后续可以只读取R，实际加速取决于算法

【OCR 预处理流水线】

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  彩色图  │ ──▶ │  灰度图  │ ──▶ │  二值图  │ ──▶ │ 文字检测 │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                  ↑ 当前学习
`);
}

/**
 * 演示 2：灰度化算法对比
 */
function demonstrateAlgorithms() {
    console.log('\n' + '='.repeat(60));
    console.log('🔬 演示 2：灰度化算法对比');
    console.log('='.repeat(60));
    
    // 创建测试颜色
    const testColors = [
        { name: '纯红色', r: 255, g: 0, b: 0 },
        { name: '纯绿色', r: 0, g: 255, b: 0 },
        { name: '纯蓝色', r: 0, g: 0, b: 255 },
        { name: '黄色', r: 255, g: 255, b: 0 },
        { name: '青色', r: 0, g: 255, b: 255 },
        { name: '品红', r: 255, g: 0, b: 255 },
        { name: '白色', r: 255, g: 255, b: 255 },
        { name: '灰色', r: 128, g: 128, b: 128 },
        { name: '肤色', r: 255, g: 200, b: 170 }
    ];
    
    console.log('\n【不同算法对同一颜色的转换结果】\n');
    console.log('颜色        RGB值              加权法  平均值  最大值  最小值  R通道  G通道  B通道');
    console.log('-'.repeat(95));
    
    testColors.forEach(color => {
        const { r, g, b, name } = color;
        
        // 计算各种灰度值
        const weighted = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const average = Math.round((r + g + b) / 3);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        
        console.log(
            `${name.padEnd(10)} (${String(r).padStart(3)},${String(g).padStart(3)},${String(b).padStart(3)})` +
            `      ${String(weighted).padStart(5)}  ${String(average).padStart(6)}  ${String(max).padStart(6)}` +
            `  ${String(min).padStart(6)}  ${String(r).padStart(5)}  ${String(g).padStart(5)}  ${String(b).padStart(5)}`
        );
    });
    
    console.log(`

【观察结论】

1. 纯绿色的加权灰度值(150)远高于纯红色(76)和纯蓝色(29)
   → 因为人眼对绿色最敏感

2. 平均值法给三种颜色相同的灰度值(85)
   → 不符合人眼感知

3. 最大值法结果偏亮，最小值法结果偏暗
   → 特殊场景使用

4. 对于白色和灰色，所有算法结果相同
   → 因为 R=G=B 时，各公式等价
`);
}

/**
 * 演示 3：加权公式的数学原理
 */
function demonstrateWeights() {
    console.log('\n' + '='.repeat(60));
    console.log('📐 演示 3：加权公式的数学原理');
    console.log('='.repeat(60));
    
    console.log(`
【为什么绿色权重最大？】

系数来自色彩原色和亮度定义，不能当作L/M/S视锥细胞的相对敏感度。

【编码值近似与线性光亮度】

1. BT.601系数直接加权编码RGB：Gray=0.299R+0.587G+0.114B（本课程默认）。
2. BT.709系数直接加权：0.2126R+0.7152G+0.0722B，仍不是sRGB线性亮度。
3. sRGB相对亮度：先用分段传递函数解码到线性RGB，再按0.2126/0.7152/0.0722计算Y，
   最后重新编码中性灰供显示。不能只换系数而省略解码/编码。

【权重验证】

所有权重之和 = 0.299 + 0.587 + 0.114 = 1.0
这确保了白色 (255,255,255) 转换后仍是 255。

验证：0.299×255 + 0.587×255 + 0.114×255 = 255 ✓
`);
}

/**
 * 演示 4：灰度直方图
 */
function demonstrateHistogram() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 演示 4：灰度直方图');
    console.log('='.repeat(60));
    
    // 创建一个模拟的灰度图像
    const imageData = new MockImageData(10, 10);
    
    // 填充一些灰度值（模拟真实图像的分布）
    const grayValues = [
        50, 52, 48, 55, 51, 120, 125, 122, 118, 123,
        53, 49, 54, 50, 52, 121, 124, 119, 122, 120,
        200, 205, 198, 202, 201, 50, 51, 52, 53, 54,
        203, 199, 204, 200, 202, 48, 52, 50, 51, 49,
        120, 122, 118, 125, 121, 200, 201, 199, 203, 202,
        123, 119, 124, 120, 122, 198, 204, 200, 201, 199,
        50, 51, 52, 53, 54, 120, 121, 122, 123, 124,
        48, 52, 50, 54, 51, 118, 122, 120, 124, 121,
        200, 201, 202, 203, 204, 50, 51, 52, 53, 54,
        198, 202, 200, 204, 201, 48, 52, 50, 54, 51
    ];
    
    // 设置像素
    for (let i = 0; i < grayValues.length; i++) {
        const x = i % 10;
        const y = Math.floor(i / 10);
        const gray = grayValues[i];
        setPixel(imageData, x, y, gray, gray, gray);
    }
    
    // 计算直方图
    const histogram = calculateHistogram(imageData);
    const stats = calculateHistogramStats(histogram, 100);
    
    console.log(`
【什么是灰度直方图？】

灰度直方图统计图像中每个灰度值（0-255）出现的次数。
横轴：灰度值（0=黑，255=白）
纵轴：该灰度值的像素数量

【示例分析】

创建了一个 10×10 的测试图像，包含三个主要灰度区域：
- 暗区域：灰度 ≈ 50（深灰）
- 中间区域：灰度 ≈ 120（中灰）
- 亮区域：灰度 ≈ 200（浅灰）

【统计结果】

最小灰度值: ${stats.min}
最大灰度值: ${stats.max}
平均灰度值: ${stats.mean.toFixed(1)}
中位数: ${stats.median}
众数: ${stats.mode}
标准差: ${stats.std.toFixed(1)}

【直方图的用途】

1. 分析图像亮度分布
   - 直方图集中在左侧 → 图像偏暗
   - 直方图集中在右侧 → 图像偏亮
   - 直方图分布均匀 → 对比度好

2. 选择二值化阈值（下一章重点）
   - 如果直方图有两个明显的峰，峰之间的谷就是好的阈值

3. 图像增强
   - 直方图均衡化可以增强对比度
`);
    
    // 简单可视化直方图
    console.log('\n【直方图可视化（部分灰度值）】\n');
    
    // 找出有值的区间
    const ranges = [
        { start: 48, end: 56, label: '暗区(48-55)' },
        { start: 118, end: 126, label: '中区(118-125)' },
        { start: 198, end: 206, label: '亮区(198-205)' }
    ];
    
    ranges.forEach(range => {
        console.log(`${range.label}:`);
        for (let i = range.start; i <= range.end; i++) {
            const count = histogram[i];
            const bar = '█'.repeat(Math.min(count, 30));
            if (count > 0) {
                console.log(`  ${String(i).padStart(3)}: ${bar} (${count})`);
            }
        }
        console.log();
    });
}

/**
 * 演示 5：完整的灰度化流程
 */
function demonstrateFullProcess() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 演示 5：完整的灰度化流程');
    console.log('='.repeat(60));
    
    // 创建一个 4x4 的彩色图像
    const imageData = new MockImageData(4, 4);
    
    // 设置一些彩色像素
    setPixel(imageData, 0, 0, 255, 0, 0);     // 红
    setPixel(imageData, 1, 0, 0, 255, 0);     // 绿
    setPixel(imageData, 2, 0, 0, 0, 255);     // 蓝
    setPixel(imageData, 3, 0, 255, 255, 0);   // 黄
    
    setPixel(imageData, 0, 1, 0, 255, 255);   // 青
    setPixel(imageData, 1, 1, 255, 0, 255);   // 品红
    setPixel(imageData, 2, 1, 255, 128, 0);   // 橙
    setPixel(imageData, 3, 1, 128, 0, 255);   // 紫
    
    setPixel(imageData, 0, 2, 255, 200, 170); // 肤色
    setPixel(imageData, 1, 2, 0, 100, 0);     // 深绿
    setPixel(imageData, 2, 2, 100, 100, 100); // 灰
    setPixel(imageData, 3, 2, 50, 50, 50);    // 深灰
    
    setPixel(imageData, 0, 3, 255, 255, 255); // 白
    setPixel(imageData, 1, 3, 200, 200, 200); // 浅灰
    setPixel(imageData, 2, 3, 0, 0, 0);       // 黑
    setPixel(imageData, 3, 3, 255, 100, 100); // 浅红
    
    console.log('\n【原始彩色图像 4×4】\n');
    console.log('  位置      RGB值           颜色名');
    console.log('  ' + '-'.repeat(40));
    
    const colorNames = [
        ['红', '绿', '蓝', '黄'],
        ['青', '品红', '橙', '紫'],
        ['肤色', '深绿', '灰', '深灰'],
        ['白', '浅灰', '黑', '浅红']
    ];
    
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const pixel = getPixel(imageData, x, y);
            console.log(
                `  (${x},${y})    (${String(pixel.r).padStart(3)},${String(pixel.g).padStart(3)},${String(pixel.b).padStart(3)})    ${colorNames[y][x]}`
            );
        }
    }
    
    // 执行灰度化
    const grayImage = grayscaleWeighted(imageData);
    
    console.log('\n【加权法灰度化后】\n');
    console.log('  位置      原RGB值            灰度值  公式验证');
    console.log('  ' + '-'.repeat(60));
    
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const original = getPixel(imageData, x, y);
            const gray = getPixel(grayImage, x, y);
            const calculated = Math.round(0.299 * original.r + 0.587 * original.g + 0.114 * original.b);
            
            console.log(
                `  (${x},${y})    (${String(original.r).padStart(3)},${String(original.g).padStart(3)},${String(original.b).padStart(3)})` +
                `        ${String(gray.r).padStart(3)}` +
                `      0.299×${String(original.r).padStart(3)} + 0.587×${String(original.g).padStart(3)} + 0.114×${String(original.b).padStart(3)} = ${calculated}`
            );
        }
    }
}

function demonstrateDefinitionCounterexamples() {
    console.log('\n【定义反例：编码值、亮度、中位数】');
    const red = createImageData(1, 1, 255, 0, 0);
    console.log(`纯红：BT.601快速灰度=${grayscaleWeighted(red).data[0]}，线性亮度再编码灰=${grayscaleLinearSrgb(red).data[0]}`);
    const mixed = createImageData(1, 1, 255, 128, 64, 128);
    console.log(`RGB(255,128,64)：158.677→${grayscaleWeighted(mixed).data[0]}；alpha仍为${grayscaleWeighted(mixed).data[3]}`);
    const h = new Array(256).fill(0); h[0] = 1; h[255] = 1;
    console.log('[0,255] 的直方图统计：', calculateHistogramStats(h, 2));
    console.log('灰度保留alpha；HTML在处理前合成白底，透明像素不会被当作黑字。');
}

// ==================== 主程序 ====================

function main() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║              03. 灰度化 (Grayscale Conversion)                 ║');
    console.log('║                    OCR 学习项目 - 第三章                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n前置知识：01. 数字图像基础 ✅  |  02. JS图像处理基础 ✅\n');
    
    // 运行所有演示
    demonstrateWhyGrayscale();
    demonstrateAlgorithms();
    demonstrateWeights();
    demonstrateDefinitionCounterexamples();
    demonstrateHistogram();
    demonstrateFullProcess();
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📚 本章总结');
    console.log('='.repeat(60));
    console.log(`
【核心知识点回顾】

1. 灰度化是 OCR 预处理的第一步
2. 推荐使用加权平均法：Gray = 0.299R + 0.587G + 0.114B
3. 绿色权重最大是因为人眼对绿色最敏感
4. 灰度直方图用于分析亮度分布和选择二值化阈值

【灰度化算法对比】

| 算法     | 公式                    | 特点     |
|----------|-------------------------|----------|
| 加权法   | 0.299R+0.587G+0.114B    | 推荐使用 |
| 平均值法 | (R+G+B)/3               | 简单快速 |
| 最大值法 | max(R,G,B)              | 结果偏亮 |
| 最小值法 | min(R,G,B)              | 结果偏暗 |

【可复用模块】

已添加到 shared/imageUtils.js：
- grayscaleWeighted() - 加权平均法
- grayscaleAverage() - 平均值法
- grayscaleMax() - 最大值法
- grayscaleMin() - 最小值法
- calculateHistogram() - 计算直方图

【下一步学习】

继续学习 04. 二值化，将灰度图进一步简化为黑白图像！
二值化是 OCR 预处理的关键步骤。
`);
}

// 运行主程序
if (require.main === module) main();

// ==================== 导出模块 ====================

module.exports = {
    grayscaleWeighted,
    grayscaleAverage,
    grayscaleMax,
    grayscaleMin,
    grayscaleSingleChannel,
    grayscaleLuminosity,
    grayscaleLinearSrgb,
    calculateHistogram,
    calculateHistogramStats
};
