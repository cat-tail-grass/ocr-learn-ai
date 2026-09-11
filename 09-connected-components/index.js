/**
 * 09. 连通域分析 (Connected Component Analysis) - Node.js 示例
 * 
 * 本文件演示连通域分析的核心算法实现：
 * 1. Two-Pass 标记算法
 * 2. 并查集（Union-Find）数据结构
 * 3. 区域属性提取
 * 4. 区域筛选与可视化
 * 
 * 前置知识：
 * - 04. 二值化（连通域分析的输入是二值图像）
 * - 08. 边缘检测（边缘信息辅助）
 * 
 * 运行方式：node index.js
 */

// 核心算法与HTML共用shared实现；下文保留可直接运行的逐步实验。
const { createImageData, cloneImageData } = require('../shared/core/imageData');
const { getPixel, setPixel } = require('../shared/core/pixelAccess');
const { UnionFind, labelConnectedComponents, extractRegionProperties, filterRegions, generateDistinctColors, colorizeLabels, extractRegionMask, extractRegionImage } = require('../shared/09-connected-components');

function createTestImage() {
    const width = 20;
    const height = 15;
    const testImage = createImageData(width, height, 255, 255, 255); // 白色背景
    
    // 绘制几个分离的形状（黑色前景）
    
    // 形状 1：左上角的矩形
    for (let y = 1; y < 4; y++) {
        for (let x = 1; x < 5; x++) {
            setPixel(testImage, x, y, 0, 0, 0);
        }
    }
    
    // 形状 2：右上角的 L 形
    for (let y = 1; y < 4; y++) {
        setPixel(testImage, 15, y, 0, 0, 0);
    }
    for (let x = 15; x < 19; x++) {
        setPixel(testImage, x, 3, 0, 0, 0);
    }
    
    // 形状 3：中间的点
    setPixel(testImage, 10, 7, 0, 0, 0);
    
    // 形状 4：底部的对角线（测试 8 连通）
    for (let i = 0; i < 5; i++) {
        setPixel(testImage, 2 + i, 10 + i % 2, 0, 0, 0);
    }
    
    // 形状 5：右下角的正方形
    for (let y = 11; y < 14; y++) {
        for (let x = 15; x < 18; x++) {
            setPixel(testImage, x, y, 0, 0, 0);
        }
    }
    
    return testImage;
}

/**
 * 打印图像的简化表示
 */
function printImage(imageData, title) {
    console.log(`\n${title}:`);
    const { width, height } = imageData;
    
    let output = '';
    for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) {
            const pixel = getPixel(imageData, x, y);
            if (pixel.r < 128) {
                row += '██';
            } else {
                row += '  ';
            }
        }
        output += row + '\n';
    }
    console.log(output);
}

/**
 * 打印标记结果
 */
function printLabels(labels, width, height, title) {
    console.log(`\n${title}:`);
    
    let output = '';
    for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const label = labels[idx];
            if (label === 0) {
                row += ' . ';
            } else {
                row += ` ${label} `;
            }
        }
        output += row + '\n';
    }
    console.log(output);
}

/**
 * 打印区域属性
 */
function printRegionProperties(regions) {
    console.log('\n区域属性统计:');
    console.log('┌───────┬──────┬─────────────────────────┬──────────────┬──────────┬──────────┐');
    console.log('│ Label │ Area │ BoundingBox             │ Centroid     │ FillRate │ AspRatio │');
    console.log('├───────┼──────┼─────────────────────────┼──────────────┼──────────┼──────────┤');
    
    for (const region of regions) {
        const bbox = `(${region.boundingBox.x},${region.boundingBox.y},${region.boundingBox.width}×${region.boundingBox.height})`;
        const centroid = `(${region.centroid.x.toFixed(1)},${region.centroid.y.toFixed(1)})`;
        console.log(`│ ${String(region.label).padStart(5)} │ ${String(region.area).padStart(4)} │ ${bbox.padEnd(23)} │ ${centroid.padEnd(12)} │ ${region.fillRatio.toFixed(2).padStart(8)} │ ${region.aspectRatio.toFixed(2).padStart(8)} │`);
    }
    
    console.log('└───────┴──────┴─────────────────────────┴──────────────┴──────────┴──────────┘');
}

// ==================== 主程序 ====================

function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║      09. 连通域分析 (Connected Component Analysis)          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    // 创建测试图像
    console.log('\n>>> 创建测试图像');
    const testImage = createTestImage();
    printImage(testImage, '原始二值图像（黑色=前景）');
    
    // 测试 8 连通标记
    console.log('\n' + '='.repeat(60));
    console.log('>>> 测试 8 连通标记');
    console.log('='.repeat(60));
    
    const result8 = labelConnectedComponents(testImage, 8);
    printLabels(result8.labels, result8.width, result8.height, '8 连通标记结果');
    
    // 提取区域属性
    const regions8 = extractRegionProperties(
        result8.labels, 
        result8.numLabels, 
        result8.width, 
        result8.height
    );
    printRegionProperties(regions8);
    
    // 测试 4 连通标记
    console.log('\n' + '='.repeat(60));
    console.log('>>> 测试 4 连通标记');
    console.log('='.repeat(60));
    
    const result4 = labelConnectedComponents(testImage, 4);
    printLabels(result4.labels, result4.width, result4.height, '4 连通标记结果');
    
    const regions4 = extractRegionProperties(
        result4.labels, 
        result4.numLabels, 
        result4.width, 
        result4.height
    );
    console.log(`\n4 连通检测到 ${regions4.length} 个区域（对角线像素被分割）`);
    console.log(`8 连通检测到 ${regions8.length} 个区域（对角线像素相连）`);
    
    // 区域过滤示例
    console.log('\n' + '='.repeat(60));
    console.log('>>> 区域过滤示例');
    console.log('='.repeat(60));
    
    const filteredRegions = filterRegions(regions8, {
        minArea: 5,  // 过滤掉面积小于 5 的区域
        maxArea: 100,
        minFillRatio: 0.3
    });
    
    console.log(`\n过滤条件: minArea=5, maxArea=100, minFillRatio=0.3`);
    console.log(`过滤前: ${regions8.length} 个区域`);
    console.log(`过滤后: ${filteredRegions.length} 个区域`);
    
    if (filteredRegions.length > 0) {
        printRegionProperties(filteredRegions);
    }
    
    console.log('>>> 讲义Two-Pass斜桥反例');
    const example = createImageData(5,4,255,255,255);
    ['11011','11011','00100','11111'].forEach((row,y)=>Array.from(row).forEach((v,x)=>{if(v==='1')setPixel(example,x,y,0,0,0)}));
    const bridge = labelConnectedComponents(example,8);
    printLabels(bridge.labels,5,4,'8连通：必须合并成1个区域');
    console.log('同一图4连通区域数=',labelConnectedComponents(example,4).numLabels);
    printRegionProperties(extractRegionProperties(bridge.labels,bridge.numLabels,5,4));
    console.log('单个黑像素的面积/BBox都是1；背景标签0不计入numLabels。');
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('>>> 在 OCR 中的应用');
    console.log('='.repeat(60));
    
    console.log(`
连通域分析用于：
1. 字符分割：连通域是候选：断开笔画可能一字多域，粘连可能多字一域
2. 噪点去除：过滤掉面积过小的区域
3. 非文字过滤：根据宽高比、填充率筛选文字区域
4. 文字行检测：根据质心位置对字符分组

推荐流程：
灰度化 → 二值化 → 形态学处理 → 连通域分析 → 属性筛选 → 字符提取
`);
    
    console.log('\n✅ 连通域分析示例完成！');
    console.log('提示：运行 index.html 可以看到更直观的可视化效果。');
}

// 运行主程序
if (require.main === module) main();

// 导出函数供其他模块使用
module.exports = {
    UnionFind,
    labelConnectedComponents,
    extractRegionProperties,
    filterRegions,
    colorizeLabels,
    generateDistinctColors,
    extractRegionMask
};
