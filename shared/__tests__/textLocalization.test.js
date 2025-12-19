/**
 * 文本区域定位模块单元测试
 * 
 * 测试内容：
 * 1. RLSA 游程平滑算法
 * 2. 区域筛选
 * 3. 文字行检测
 * 4. 字符分割
 * 5. 字符排序
 */

const { MockImageData, createImageData } = require('../core/imageData');
const { setPixel, getPixel } = require('../core/pixelAccess');
const {
    horizontalRLSA,
    verticalRLSA,
    filterCandidateCharacters,
    detectTextLines,
    groupRegionsIntoLines,
    segmentCharacters,
    sortCharacters,
    extractLineImage,
    calculateRegionStats,
    localizeText
} = require('../10-text-localization');

// ==================== 测试辅助函数 ====================

/**
 * 创建测试用的二值图像
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {number[][]} foregroundPixels - 前景像素坐标 [[x, y], ...]
 * @returns {MockImageData}
 */
function createBinaryImage(width, height, foregroundPixels = []) {
    const imageData = createImageData(width, height, 255, 255, 255);
    
    for (const [x, y] of foregroundPixels) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            setPixel(imageData, x, y, 0, 0, 0);
        }
    }
    
    return imageData;
}

/**
 * 创建包含文字行的测试图像
 */
function createTextLineImage() {
    const width = 50;
    const height = 30;
    const pixels = [];
    
    // 第一行文字 (y=3-8)
    for (let x = 5; x < 12; x++) {
        for (let y = 3; y < 9; y++) {
            pixels.push([x, y]);
        }
    }
    for (let x = 15; x < 22; x++) {
        for (let y = 3; y < 9; y++) {
            pixels.push([x, y]);
        }
    }
    for (let x = 25; x < 30; x++) {
        for (let y = 3; y < 9; y++) {
            pixels.push([x, y]);
        }
    }
    
    // 第二行文字 (y=15-22)
    for (let x = 8; x < 16; x++) {
        for (let y = 15; y < 22; y++) {
            pixels.push([x, y]);
        }
    }
    for (let x = 20; x < 28; x++) {
        for (let y = 15; y < 22; y++) {
            pixels.push([x, y]);
        }
    }
    
    return createBinaryImage(width, height, pixels);
}

// ==================== 测试用例 ====================

describe('RLSA 游程平滑算法', () => {
    test('horizontalRLSA 应该连接水平方向的近距离前景像素', () => {
        // 创建有间隔的前景像素: 0位置和3位置有前景，间隔2像素
        const pixels = [[0, 0], [3, 0]];
        const imageData = createBinaryImage(10, 5, pixels);
        
        // 使用阈值3进行RLSA
        const result = horizontalRLSA(imageData, 3);
        
        // 检查间隔是否被填充
        expect(getPixel(result, 0, 0).r).toBeLessThan(128); // 原始前景
        expect(getPixel(result, 1, 0).r).toBeLessThan(128); // 应该被填充
        expect(getPixel(result, 2, 0).r).toBeLessThan(128); // 应该被填充
        expect(getPixel(result, 3, 0).r).toBeLessThan(128); // 原始前景
    });
    
    test('horizontalRLSA 不应该连接超过阈值距离的像素', () => {
        // 间隔5像素
        const pixels = [[0, 0], [6, 0]];
        const imageData = createBinaryImage(10, 5, pixels);
        
        // 使用阈值3进行RLSA
        const result = horizontalRLSA(imageData, 3);
        
        // 间隔不应该被填充
        expect(getPixel(result, 0, 0).r).toBeLessThan(128); // 原始前景
        expect(getPixel(result, 3, 0).r).toBeGreaterThanOrEqual(128); // 不应该被填充
        expect(getPixel(result, 6, 0).r).toBeLessThan(128); // 原始前景
    });
    
    test('verticalRLSA 应该连接垂直方向的近距离前景像素', () => {
        const pixels = [[0, 0], [0, 3]];
        const imageData = createBinaryImage(5, 10, pixels);
        
        const result = verticalRLSA(imageData, 3);
        
        expect(getPixel(result, 0, 0).r).toBeLessThan(128);
        expect(getPixel(result, 0, 1).r).toBeLessThan(128); // 应该被填充
        expect(getPixel(result, 0, 2).r).toBeLessThan(128); // 应该被填充
        expect(getPixel(result, 0, 3).r).toBeLessThan(128);
    });
    
    test('RLSA 阈值为0时不应该改变图像', () => {
        const pixels = [[0, 0], [5, 0]];
        const imageData = createBinaryImage(10, 5, pixels);
        
        const result = horizontalRLSA(imageData, 0);
        
        expect(getPixel(result, 0, 0).r).toBeLessThan(128);
        expect(getPixel(result, 2, 0).r).toBeGreaterThanOrEqual(128); // 不应该被填充
        expect(getPixel(result, 5, 0).r).toBeLessThan(128);
    });
});

describe('区域筛选', () => {
    test('filterCandidateCharacters 应该过滤面积过小的区域', () => {
        const regions = [
            { area: 10, aspectRatio: 1.0, fillRatio: 0.5 },
            { area: 50, aspectRatio: 1.0, fillRatio: 0.5 },
            { area: 100, aspectRatio: 1.0, fillRatio: 0.5 }
        ];
        
        const result = filterCandidateCharacters(regions, { minArea: 30 });
        
        expect(result.length).toBe(2);
        expect(result.every(r => r.area >= 30)).toBe(true);
    });
    
    test('filterCandidateCharacters 应该过滤面积过大的区域', () => {
        const regions = [
            { area: 50, aspectRatio: 1.0, fillRatio: 0.5 },
            { area: 500, aspectRatio: 1.0, fillRatio: 0.5 },
            { area: 5000, aspectRatio: 1.0, fillRatio: 0.5 }
        ];
        
        const result = filterCandidateCharacters(regions, { maxArea: 1000 });
        
        expect(result.length).toBe(2);
        expect(result.every(r => r.area <= 1000)).toBe(true);
    });
    
    test('filterCandidateCharacters 应该过滤宽高比异常的区域', () => {
        const regions = [
            { area: 100, aspectRatio: 0.05, fillRatio: 0.5 },  // 太窄
            { area: 100, aspectRatio: 1.0, fillRatio: 0.5 },   // 正常
            { area: 100, aspectRatio: 10.0, fillRatio: 0.5 }   // 太宽
        ];
        
        const result = filterCandidateCharacters(regions, { 
            minAspectRatio: 0.1, 
            maxAspectRatio: 5.0 
        });
        
        expect(result.length).toBe(1);
        expect(result[0].aspectRatio).toBe(1.0);
    });
    
    test('filterCandidateCharacters 应该过滤填充率过低的区域', () => {
        const regions = [
            { area: 100, aspectRatio: 1.0, fillRatio: 0.05 },
            { area: 100, aspectRatio: 1.0, fillRatio: 0.5 }
        ];
        
        const result = filterCandidateCharacters(regions, { minFillRatio: 0.1 });
        
        expect(result.length).toBe(1);
        expect(result[0].fillRatio).toBe(0.5);
    });
});

describe('文字行检测', () => {
    test('detectTextLines 应该检测到多行文字', () => {
        const imageData = createTextLineImage();
        
        const lines = detectTextLines(imageData, { 
            minLineHeight: 3,
            projectionThreshold: 0.05 
        });
        
        expect(lines.length).toBe(2);
    });
    
    test('detectTextLines 应该返回正确的行位置', () => {
        const imageData = createTextLineImage();
        
        const lines = detectTextLines(imageData, { 
            minLineHeight: 3,
            projectionThreshold: 0.05 
        });
        
        // 第一行应该在 y=3 左右
        expect(lines[0].y).toBeLessThan(10);
        // 第二行应该在 y=15 左右
        expect(lines[1].y).toBeGreaterThan(10);
    });
    
    test('detectTextLines 应该忽略过矮的行', () => {
        // 创建只有2像素高的区域
        const pixels = [];
        for (let x = 5; x < 20; x++) {
            pixels.push([x, 5], [x, 6]);
        }
        const imageData = createBinaryImage(30, 20, pixels);
        
        const lines = detectTextLines(imageData, { 
            minLineHeight: 5,  // 最小行高5
            projectionThreshold: 0.05 
        });
        
        expect(lines.length).toBe(0);
    });
});

describe('字符分割', () => {
    test('segmentCharacters 应该分割出多个字符', () => {
        const imageData = createTextLineImage();
        
        // 使用第一行区域
        const lineRegion = { x: 0, y: 3, width: 50, height: 6 };
        
        const characters = segmentCharacters(imageData, lineRegion, { 
            minCharWidth: 3,
            gapThreshold: 0.0 
        });
        
        expect(characters.length).toBe(3); // 应该有3个字符
    });
    
    test('segmentCharacters 返回的字符应该有正确的位置', () => {
        const imageData = createTextLineImage();
        const lineRegion = { x: 0, y: 3, width: 50, height: 6 };
        
        const characters = segmentCharacters(imageData, lineRegion, { 
            minCharWidth: 3 
        });
        
        // 所有字符的y坐标应该等于行的y坐标
        for (const char of characters) {
            expect(char.y).toBe(3);
        }
        
        // 字符应该按x坐标排列
        for (let i = 1; i < characters.length; i++) {
            expect(characters[i].x).toBeGreaterThan(characters[i-1].x);
        }
    });
});

describe('字符排序', () => {
    test('sortCharacters 应该按从左到右、从上到下排序', () => {
        const characters = [
            { x: 50, y: 10, width: 10, height: 15 },  // 第一行右
            { x: 10, y: 10, width: 10, height: 15 },  // 第一行左
            { x: 30, y: 50, width: 10, height: 15 },  // 第二行中
            { x: 10, y: 50, width: 10, height: 15 },  // 第二行左
        ];
        
        const sorted = sortCharacters(characters);
        
        // 第一个应该是第一行左边的
        expect(sorted[0].x).toBe(10);
        expect(sorted[0].y).toBe(10);
        
        // 第二个应该是第一行右边的
        expect(sorted[1].x).toBe(50);
        expect(sorted[1].y).toBe(10);
        
        // 第三个应该是第二行左边的
        expect(sorted[2].x).toBe(10);
        expect(sorted[2].y).toBe(50);
        
        // 第四个应该是第二行右边的
        expect(sorted[3].x).toBe(30);
        expect(sorted[3].y).toBe(50);
    });
    
    test('sortCharacters 空数组应该返回空数组', () => {
        expect(sortCharacters([])).toEqual([]);
    });
    
    test('sortCharacters 单个字符应该正确返回', () => {
        const characters = [{ x: 10, y: 10, width: 10, height: 15 }];
        const sorted = sortCharacters(characters);
        expect(sorted.length).toBe(1);
        expect(sorted[0]).toEqual(characters[0]);
    });
});

describe('区域分组', () => {
    test('groupRegionsIntoLines 应该按行分组区域', () => {
        const regions = [
            { centroid: { x: 10, y: 10 }, boundingBox: { height: 15 } },
            { centroid: { x: 50, y: 12 }, boundingBox: { height: 15 } },  // 同行
            { centroid: { x: 20, y: 50 }, boundingBox: { height: 15 } },  // 新行
            { centroid: { x: 60, y: 52 }, boundingBox: { height: 15 } },  // 同行
        ];
        
        const lines = groupRegionsIntoLines(regions);
        
        expect(lines.length).toBe(2);
        expect(lines[0].length).toBe(2); // 第一行2个
        expect(lines[1].length).toBe(2); // 第二行2个
    });
    
    test('groupRegionsIntoLines 空数组应该返回空数组', () => {
        expect(groupRegionsIntoLines([])).toEqual([]);
    });
});

describe('辅助函数', () => {
    test('extractLineImage 应该正确提取行区域', () => {
        const imageData = createTextLineImage();
        const lineRegion = { x: 5, y: 3, width: 25, height: 6 };
        
        const lineImage = extractLineImage(imageData, lineRegion, 0);
        
        expect(lineImage.width).toBe(25);
        expect(lineImage.height).toBe(6);
    });
    
    test('extractLineImage 应该添加边距', () => {
        const imageData = createTextLineImage();
        const lineRegion = { x: 5, y: 5, width: 20, height: 10 };
        
        const lineImage = extractLineImage(imageData, lineRegion, 2);
        
        // 带2像素边距
        expect(lineImage.width).toBe(24);
        expect(lineImage.height).toBe(14);
    });
    
    test('calculateRegionStats 应该计算正确的统计信息', () => {
        const regions = [
            { area: 100, boundingBox: { width: 10, height: 20 }, aspectRatio: 0.5 },
            { area: 200, boundingBox: { width: 20, height: 20 }, aspectRatio: 1.0 },
        ];
        
        const stats = calculateRegionStats(regions);
        
        expect(stats.count).toBe(2);
        expect(stats.avgArea).toBe(150);
        expect(stats.avgWidth).toBe(15);
        expect(stats.avgHeight).toBe(20);
        expect(stats.avgAspectRatio).toBe(0.75);
    });
    
    test('calculateRegionStats 空数组应该返回0', () => {
        const stats = calculateRegionStats([]);
        
        expect(stats.count).toBe(0);
        expect(stats.avgArea).toBe(0);
    });
});

describe('完整流程', () => {
    test('localizeText 应该返回完整的定位结果', () => {
        const imageData = createTextLineImage();
        
        const result = localizeText(imageData, {
            minArea: 10,
            minLineHeight: 3
        });
        
        expect(result).toHaveProperty('allRegions');
        expect(result).toHaveProperty('candidateRegions');
        expect(result).toHaveProperty('lines');
        expect(result).toHaveProperty('characters');
        expect(result).toHaveProperty('stats');
    });
    
    test('localizeText 统计信息应该正确', () => {
        const imageData = createTextLineImage();
        
        const result = localizeText(imageData, {
            minArea: 10,
            minLineHeight: 3
        });
        
        expect(result.stats.totalRegions).toBeGreaterThan(0);
        expect(result.stats.lineCount).toBe(2); // 应该有2行
    });
});
