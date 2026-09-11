/**
 * 文本区域定位模块
 * 
 * 提供文字行检测、字符分割、区域筛选等功能
 * 
 * 来源：10. 文本区域定位
 */

const { createImageData, cloneImageData } = require('../core/imageData');
const { getPixel, setPixel } = require('../core/pixelAccess');
const { calculateHorizontalProjection, calculateVerticalProjection } = require('../07-deskewing');
const { labelConnectedComponents, extractRegionProperties } = require('../09-connected-components');

// ==================== RLSA 游程平滑算法 ====================

/**
 * 水平 RLSA（Run Length Smoothing Algorithm）
 * 
 * 原理说明：
 * - 扫描每一行，连接间隔小于阈值的前景像素
 * - 用于将同一行的字符连接成文字块
 * - 阈值通常设为字符平均宽度的 1~2 倍
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number} threshold - 连接阈值（背景像素数）
 * @param {number} foregroundThreshold - 前景像素值判断阈值（默认 < 128 为前景）
 * @returns {MockImageData} 处理后的图像
 */
function horizontalRLSA(imageData, threshold, foregroundThreshold = 128) {
    const { width, height } = imageData;
    const result = cloneImageData(imageData);
    
    // 逐行处理
    for (let y = 0; y < height; y++) {
        let lastForegroundX = -threshold - 1; // 上一个前景像素的 X 坐标
        
        for (let x = 0; x < width; x++) {
            const pixel = getPixel(result, x, y);
            
            // 检查是否为前景像素
            if (pixel.r < foregroundThreshold) {
                // 计算与上一个前景像素的间隔
                const gap = x - lastForegroundX - 1;
                
                // 如果间隔在阈值范围内，填充中间的背景像素
                if (gap > 0 && gap <= threshold) {
                    for (let i = lastForegroundX + 1; i < x; i++) {
                        setPixel(result, i, y, 0, 0, 0);
                    }
                }
                
                lastForegroundX = x;
            }
        }
    }
    
    return result;
}

/**
 * 垂直 RLSA（Run Length Smoothing Algorithm）
 * 
 * 原理说明：
 * - 扫描每一列，连接间隔小于阈值的前景像素
 * - 用于连接上下相邻的内容
 * - 阈值通常设为行高的 0.5~1 倍
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {number} threshold - 连接阈值（背景像素数）
 * @param {number} foregroundThreshold - 前景像素值判断阈值（默认 < 128 为前景）
 * @returns {MockImageData} 处理后的图像
 */
function verticalRLSA(imageData, threshold, foregroundThreshold = 128) {
    const { width, height } = imageData;
    const result = cloneImageData(imageData);
    
    // 逐列处理
    for (let x = 0; x < width; x++) {
        let lastForegroundY = -threshold - 1; // 上一个前景像素的 Y 坐标
        
        for (let y = 0; y < height; y++) {
            const pixel = getPixel(result, x, y);
            
            // 检查是否为前景像素
            if (pixel.r < foregroundThreshold) {
                // 计算与上一个前景像素的间隔
                const gap = y - lastForegroundY - 1;
                
                // 如果间隔在阈值范围内，填充中间的背景像素
                if (gap > 0 && gap <= threshold) {
                    for (let i = lastForegroundY + 1; i < y; i++) {
                        setPixel(result, x, i, 0, 0, 0);
                    }
                }
                
                lastForegroundY = y;
            }
        }
    }
    
    return result;
}

// ==================== 区域筛选 ====================

/**
 * 筛选候选字符区域
 * 
 * 原理说明：
 * - 基于连通域的属性筛选可能的字符区域
 * - 过滤太小（噪点）、太大（背景块）的区域
 * - 过滤形状异常（宽高比不合理）的区域
 * - 过滤填充率过低（稀疏）的区域
 * 
 * @param {object[]} regions - 连通域区域属性数组
 * @param {object} options - 筛选参数
 * @param {number} options.minArea - 最小面积（默认 30）
 * @param {number} options.maxArea - 最大面积（默认 10000）
 * @param {number} options.minAspectRatio - 最小宽高比（默认 0.1）
 * @param {number} options.maxAspectRatio - 最大宽高比（默认 5.0）
 * @param {number} options.minFillRatio - 最小填充率（默认 0.1）
 * @returns {object[]} 候选字符区域
 */
function filterCandidateCharacters(regions, options = {}) {
    const {
        minArea = 30,
        maxArea = 10000,
        minAspectRatio = 0.1,
        maxAspectRatio = 5.0,
        minFillRatio = 0.1
    } = options;
    
    return regions.filter(region => {
        // 面积筛选
        if (region.area < minArea || region.area > maxArea) return false;
        
        // 宽高比筛选
        if (region.aspectRatio < minAspectRatio) return false;
        if (region.aspectRatio > maxAspectRatio) return false;
        
        // 填充率筛选
        if (region.fillRatio < minFillRatio) return false;
        
        return true;
    });
}

// ==================== 文字行检测 ====================

/**
 * 使用投影分析检测文字行
 * 
 * 原理说明：
 * - 计算水平投影（每行前景像素数）
 * - 投影峰值对应文字行位置
 * - 投影谷值对应行间距位置
 * - 通过阈值分割检测行边界
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {object} options - 配置选项
 * @param {number} options.minLineHeight - 最小行高（默认 10）
 * @param {number} options.projectionThreshold - 投影阈值比例（默认 0.1）
 * @returns {object[]} 文字行边界框数组 [{x, y, width, height}, ...]
 */
function detectTextLines(imageData, options = {}) {
    const {
        minLineHeight = 10,
        projectionThreshold = 0.1
    } = options;
    
    const { width, height } = imageData;
    
    // Step 1: 计算水平投影
    const projection = calculateHorizontalProjection(imageData);
    
    // Step 2: 计算阈值
    const maxProjection = projection.reduce((max, value) => Math.max(max, value), 0);
    const threshold = maxProjection * projectionThreshold;
    
    // Step 3: 检测行区域
    const lines = [];
    let inLine = false;
    let lineStart = 0;
    
    for (let y = 0; y <= height; y++) {
        if (!inLine && y < height && projection[y] > threshold) {
            // 进入行区域
            inLine = true;
            lineStart = y;
        } else if (inLine && (y === height || projection[y] <= threshold)) {
            // 离开行区域
            inLine = false;
            const lineEnd = y; // 末尾额外哨兵使最后一行也能闭合，区间[start,end)
            const lineHeight = lineEnd - lineStart;
            
            if (lineHeight >= minLineHeight) {
                // 计算该行的水平范围（非零投影区域）
                let minX = width, maxX = 0;
                for (let ly = lineStart; ly < lineEnd; ly++) {
                    for (let x = 0; x < width; x++) {
                        const pixel = getPixel(imageData, x, ly);
                        if (pixel.r < 128) {
                            minX = Math.min(minX, x);
                            maxX = Math.max(maxX, x);
                        }
                    }
                }
                
                lines.push({
                    x: minX,
                    y: lineStart,
                    width: maxX - minX + 1,
                    height: lineHeight
                });
            }
        }
    }
    
    return lines;
}

/**
 * 将区域按行分组
 * 
 * 原理说明：
 * - 根据区域的质心 Y 坐标将区域聚类成行
 * - Y 坐标差异在阈值内的区域归为同一行
 * - 适用于预先通过连通域分析提取的字符区域
 * 
 * @param {object[]} regions - 区域属性数组（需包含 centroid 属性）
 * @param {object} options - 配置选项
 * @param {number} options.lineThreshold - 行判定阈值（默认为平均高度的 0.5 倍）
 * @returns {object[][]} 按行分组的区域数组
 */
function groupRegionsIntoLines(regions, options = {}) {
    if (regions.length === 0) return [];
    
    // 计算平均高度作为默认阈值基准
    const avgHeight = regions.reduce((sum, r) => sum + r.boundingBox.height, 0) / regions.length;
    const { lineThreshold = avgHeight * 0.5 } = options;
    
    // 按质心 Y 坐标排序
    const sorted = [...regions].sort((a, b) => a.centroid.y - b.centroid.y || a.boundingBox.x - b.boundingBox.x);
    
    // 聚类分行
    const lines = [];
    let currentLine = [sorted[0]];
    let currentLineY = sorted[0].centroid.y;
    
    for (let i = 1; i < sorted.length; i++) {
        const region = sorted[i];
        
        // 判断是否属于当前行
        if (Math.abs(region.centroid.y - currentLineY) <= lineThreshold) {
            currentLine.push(region);
            // 更新当前行的平均 Y 坐标
            currentLineY = currentLine.reduce((sum, r) => sum + r.centroid.y, 0) / currentLine.length;
        } else {
            // 开始新行
            lines.push(currentLine);
            currentLine = [region];
            currentLineY = region.centroid.y;
        }
    }
    
    // 添加最后一行
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }
    
    return lines;
}

// ==================== 字符分割 ====================

/**
 * 使用垂直投影分割字符
 * 
 * 原理说明：
 * - 对文字行区域计算垂直投影
 * - 投影谷值（值为 0 或很小）对应字符间隔
 * - 在谷值位置分割得到单个字符
 * 
 * @param {ImageData|MockImageData} imageData - 原始二值图像
 * @param {object} lineRegion - 文字行边界框 {x, y, width, height}
 * @param {object} options - 配置选项
 * @param {number} options.minCharWidth - 最小字符宽度（默认 5）
 * @param {number} options.gapThreshold - 间隔阈值比例（默认 0.1）
 * @returns {object[]} 字符边界框数组
 */
function segmentCharacters(imageData, lineRegion, options = {}) {
    const {
        minCharWidth = 5,
        gapThreshold = 0.1
    } = options;
    
    const { x: lineX, y: lineY, width: lineWidth, height: lineHeight } = lineRegion;
    
    // Step 1: 计算行区域内的垂直投影
    const projection = new Array(lineWidth).fill(0);
    
    for (let dx = 0; dx < lineWidth; dx++) {
        for (let dy = 0; dy < lineHeight; dy++) {
            const x = lineX + dx;
            const y = lineY + dy;
            
            // 边界检查
            if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
                const pixel = getPixel(imageData, x, y);
                if (pixel.r < 128) {
                    projection[dx]++;
                }
            }
        }
    }
    
    // Step 2: 计算阈值
    const maxProjection = projection.reduce((max, value) => Math.max(max, value), 0);
    const threshold = maxProjection * gapThreshold;
    
    // Step 3: 找到字符边界
    const characters = [];
    let inChar = false;
    let charStart = 0;
    
    for (let x = 0; x <= lineWidth; x++) {
        if (!inChar && x < lineWidth && projection[x] > threshold) {
            // 进入字符区域
            inChar = true;
            charStart = x;
        } else if (inChar && (x === lineWidth || projection[x] <= threshold)) {
            // 离开字符区域
            inChar = false;
            const charEnd = x; // 半开区间，包含恰好开始于末列的字符
            const charWidth = charEnd - charStart;
            
            if (charWidth >= minCharWidth) {
                characters.push({
                    x: lineX + charStart,
                    y: lineY,
                    width: charWidth,
                    height: lineHeight
                });
            }
        }
    }
    
    return characters;
}

/**
 * 使用连通域分割字符
 * 
 * 原理说明：
 * - 对文字行区域进行连通域分析
 * - 每个连通域视为一个字符
 * - 适合字符分离良好的印刷体
 * 
 * @param {ImageData|MockImageData} imageData - 文字行图像
 * @param {object} options - 配置选项
 * @returns {object[]} 字符边界框数组
 */
function segmentCharactersByCC(imageData, options = {}) {
    const { minArea = 20 } = options;
    
    // 进行连通域分析
    const { labels, numLabels, width, height } = labelConnectedComponents(imageData);
    
    // 提取区域属性
    const regions = extractRegionProperties(labels, numLabels, width, height);
    
    // 过滤太小的区域
    return regions
        .filter(r => r.area >= minArea)
        .map(r => r.boundingBox);
}

// ==================== 字符排序 ====================

/**
 * 按阅读顺序排序字符
 * 
 * 原理说明：
 * - 先按 Y 坐标（行）排序
 * - 同一行内按 X 坐标排序
 * - 适用于从左到右、从上到下的阅读顺序
 * 
 * @param {object[]} characters - 字符边界框数组
 * @param {object} options - 配置选项
 * @param {number} options.lineThreshold - 同行判定阈值（Y 坐标差异）
 * @returns {object[]} 排序后的字符数组
 */
function sortCharacters(characters, options = {}) {
    // 不能把“Y差小于阈值”放进sort比较器：A同行B、B同行C不意味着A同行C，
    // 会产生比较环，导致结果随输入排列改变。先分配行，再在行内按x排序。
    const regions = characters.map(box => ({
        boundingBox: box,
        centroid: { x: box.x + (box.width - 1) / 2, y: box.y + (box.height - 1) / 2 },
        original: box
    }));
    const lines = groupRegionsIntoLines(regions, options);
    return lines.flatMap(line => line.map(r => r.original).sort((a, b) =>
        a.x - b.x || a.y - b.y || a.width - b.width || a.height - b.height));
}

// ==================== 辅助函数 ====================

/**
 * 提取文字行图像
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像
 * @param {object} lineRegion - 行边界框 {x, y, width, height}
 * @param {number} padding - 边距（默认 2）
 * @returns {MockImageData} 提取的行图像
 */
function extractLineImage(imageData, lineRegion, padding = 2) {
    const { x, y, width: w, height: h } = lineRegion;
    
    // 添加边距
    const x1 = Math.max(0, x - padding);
    const y1 = Math.max(0, y - padding);
    const x2 = Math.min(imageData.width, x + w + padding);
    const y2 = Math.min(imageData.height, y + h + padding);
    
    const newWidth = x2 - x1;
    const newHeight = y2 - y1;
    
    const result = createImageData(newWidth, newHeight, 255, 255, 255);
    
    for (let dy = 0; dy < newHeight; dy++) {
        for (let dx = 0; dx < newWidth; dx++) {
            const pixel = getPixel(imageData, x1 + dx, y1 + dy);
            setPixel(result, dx, dy, pixel.r, pixel.g, pixel.b, pixel.a);
        }
    }
    
    return result;
}

/**
 * 计算区域统计信息
 * 
 * @param {object[]} regions - 区域数组
 * @returns {object} 统计信息
 */
function calculateRegionStats(regions) {
    if (regions.length === 0) {
        return {
            count: 0,
            avgArea: 0,
            avgWidth: 0,
            avgHeight: 0,
            avgAspectRatio: 0
        };
    }
    
    const stats = regions.reduce((acc, r) => {
        acc.totalArea += r.area || (r.width * r.height);
        acc.totalWidth += r.boundingBox?.width || r.width;
        acc.totalHeight += r.boundingBox?.height || r.height;
        acc.totalAspectRatio += r.aspectRatio || (r.width / r.height);
        return acc;
    }, { totalArea: 0, totalWidth: 0, totalHeight: 0, totalAspectRatio: 0 });
    
    return {
        count: regions.length,
        avgArea: stats.totalArea / regions.length,
        avgWidth: stats.totalWidth / regions.length,
        avgHeight: stats.totalHeight / regions.length,
        avgAspectRatio: stats.totalAspectRatio / regions.length
    };
}

/** 只保留候选连通域的真实像素，不能填满边界框，否则会填掉字内空洞。 */
function maskCandidateRegions(imageData, regions) {
    const result = createImageData(imageData.width, imageData.height, 255, 255, 255);
    for (const region of regions) {
        for (const { x, y } of region.pixels) setPixel(result, x, y, 0, 0, 0);
    }
    return result;
}

/**
 * 完整的文本定位流程
 * 
 * 将二值图像处理成有序的字符区域列表
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像
 * @param {object} options - 配置选项
 * @returns {object} 定位结果
 */
function localizeText(imageData, options = {}) {
    const {
        // 区域筛选参数
        minArea = 30,
        maxArea = 10000,
        minAspectRatio = 0.1,
        maxAspectRatio = 5.0,
        minFillRatio = 0.1,
        // 行检测参数
        minLineHeight = 10,
        projectionThreshold = 0.1,
        // 字符分割参数
        minCharWidth = 5,
        gapThreshold = 0.1
    } = options;
    
    // Step 1: 连通域分析
    const { labels, numLabels, width, height } = labelConnectedComponents(imageData);
    const allRegions = extractRegionProperties(labels, numLabels, width, height);
    
    // Step 2: 区域筛选
    const candidateRegions = filterCandidateCharacters(allRegions, {
        minArea, maxArea, minAspectRatio, maxAspectRatio, minFillRatio
    });
    
    // Step 3: 筛选实际作用于投影输入。否则minArea等参数只改变统计，不改变输出。
    const filteredImageData = maskCandidateRegions(imageData, candidateRegions);
    const lines = detectTextLines(filteredImageData, { minLineHeight, projectionThreshold });
    
    // Step 4: 字符分割（对每行进行）
    const allCharacters = [];
    for (const line of lines) {
        const chars = segmentCharacters(filteredImageData, line, { minCharWidth, gapThreshold });
        allCharacters.push(...chars);
    }
    
    // Step 5: 字符排序
    const sortedCharacters = sortCharacters(allCharacters);
    
    return {
        filteredImageData,
        // 所有连通域
        allRegions,
        // 候选字符区域
        candidateRegions,
        // 检测到的文字行
        lines,
        // 分割的字符（已排序）
        characters: sortedCharacters,
        // 统计信息
        stats: {
            totalRegions: allRegions.length,
            candidateCount: candidateRegions.length,
            lineCount: lines.length,
            characterCount: sortedCharacters.length
        }
    };
}

// ==================== 导出模块 ====================

module.exports = {
    // RLSA 算法
    horizontalRLSA,
    verticalRLSA,
    
    // 区域筛选
    filterCandidateCharacters,
    
    // 行检测
    detectTextLines,
    groupRegionsIntoLines,
    
    // 字符分割
    segmentCharacters,
    segmentCharactersByCC,
    
    // 字符排序
    sortCharacters,
    
    // 辅助函数
    extractLineImage,
    calculateRegionStats,
    
    // 完整流程
    maskCandidateRegions,
    localizeText
};
