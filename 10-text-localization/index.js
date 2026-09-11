/**
 * 10. 文本区域定位 - Node.js 示例
 * 
 * 功能说明：
 * 本示例演示文本区域定位的核心算法：
 * 1. RLSA 游程平滑算法
 * 2. 区域特征筛选
 * 3. 投影分析检测文字行
 * 4. 垂直投影分割字符
 * 5. 字符排序
 * 
 * 运行方式：
 * cd 10-text-localization && node index.js
 */

// 核心算法与HTML共用shared实现；下文保留可直接运行的逐步实验。
const { createImageData, cloneImageData } = require('../shared/core/imageData');
const { getPixel, setPixel } = require('../shared/core/pixelAccess');
const { horizontalRLSA, verticalRLSA, filterCandidateCharacters, detectTextLines, groupRegionsIntoLines, segmentCharacters, segmentCharactersByCC, sortCharacters, extractLineImage, calculateRegionStats, maskCandidateRegions, localizeText } = require('../shared/10-text-localization');
const { calculateHorizontalProjection, calculateVerticalProjection } = require('../shared/07-deskewing');
const { labelConnectedComponents, extractRegionProperties } = require('../shared/09-connected-components');

function createTextImage() {
    const width = 100;
    const height = 60;
    const imageData = createImageData(width, height, 255, 255, 255);
    
    // 绘制模拟文字 - 第一行 "AB"
    // 字母 A (位置: 10-20, 5-15)
    const letterA = [
        [0,0,1,1,0,0],
        [0,1,0,0,1,0],
        [0,1,0,0,1,0],
        [0,1,1,1,1,0],
        [0,1,0,0,1,0],
        [0,1,0,0,1,0],
        [0,1,0,0,1,0]
    ];
    
    // 字母 B (位置: 25-35, 5-15)
    const letterB = [
        [1,1,1,0,0],
        [1,0,0,1,0],
        [1,0,0,1,0],
        [1,1,1,0,0],
        [1,0,0,1,0],
        [1,0,0,1,0],
        [1,1,1,0,0]
    ];
    
    // 字母 C (位置: 40-50, 5-15)
    const letterC = [
        [0,1,1,1,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [0,1,1,1,0]
    ];
    
    // 绘制第一行
    drawLetter(imageData, letterA, 10, 5);
    drawLetter(imageData, letterB, 22, 5);
    drawLetter(imageData, letterC, 33, 5);
    
    // 绘制第二行 - "DE"
    const letterD = [
        [1,1,1,0,0],
        [1,0,0,1,0],
        [1,0,0,1,0],
        [1,0,0,1,0],
        [1,0,0,1,0],
        [1,0,0,1,0],
        [1,1,1,0,0]
    ];
    
    const letterE = [
        [1,1,1,1,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,1,1,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,0]
    ];
    
    drawLetter(imageData, letterD, 15, 25);
    drawLetter(imageData, letterE, 28, 25);
    
    // 绘制第三行 - "F"
    const letterF = [
        [1,1,1,1,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,1,1,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0]
    ];
    
    drawLetter(imageData, letterF, 20, 45);
    
    return imageData;
}

/**
 * 绘制字母到图像
 */
function drawLetter(imageData, pattern, startX, startY) {
    for (let y = 0; y < pattern.length; y++) {
        for (let x = 0; x < pattern[y].length; x++) {
            if (pattern[y][x] === 1) {
                const px = startX + x;
                const py = startY + y;
                if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
                    setPixel(imageData, px, py, 0, 0, 0);
                }
            }
        }
    }
}

/**
 * 打印图像到控制台
 */
function printImage(imageData, title) {
    console.log(`\n${title} (${imageData.width}x${imageData.height}):`);
    
    let output = '';
    for (let y = 0; y < imageData.height; y++) {
        let row = '';
        for (let x = 0; x < imageData.width; x++) {
            const pixel = getPixel(imageData, x, y);
            row += pixel.r < 128 ? '█' : ' ';
        }
        // 只打印非空行
        if (row.trim()) {
            output += `${String(y).padStart(2, ' ')}|${row}|\n`;
        }
    }
    console.log(output);
}

/**
 * 打印投影直方图
 */
function printProjection(projection, title, horizontal = true) {
    console.log(`\n${title}:`);
    
    const maxVal = Math.max(...projection);
    const scale = 20 / maxVal; // 缩放到 20 个字符宽度
    
    if (horizontal) {
        // 水平投影（每行显示一个值）
        for (let i = 0; i < projection.length; i++) {
            if (projection[i] > 0) {
                const bar = '█'.repeat(Math.round(projection[i] * scale));
                console.log(`${String(i).padStart(2, ' ')}|${bar} (${projection[i]})`);
            }
        }
    } else {
        // 垂直投影（简化显示）
        console.log('位置: ' + projection.map((v, i) => v > 0 ? String(i).padStart(2, ' ') : '  ').join(' '));
        console.log('数值: ' + projection.map(v => v > 0 ? String(v).padStart(2, ' ') : '  ').join(' '));
    }
}

// ==================== 主函数 ====================

function main() {
    console.log('='.repeat(60));
    console.log('10. 文本区域定位 - 算法演示');
    console.log('='.repeat(60));
    
    // 创建测试图像
    console.log('\n【步骤 1】创建测试图像');
    const imageData = createTextImage();
    printImage(imageData, '原始二值图像（模拟 ABC/DE/F 三行文字）');
    
    // 连通域分析
    console.log('\n【步骤 2】连通域分析');
    const { labels, numLabels, width, height } = labelConnectedComponents(imageData);
    console.log(`  检测到 ${numLabels} 个连通域`);
    
    // 提取区域属性
    const regions = extractRegionProperties(labels, numLabels, width, height);
    console.log('\n  区域属性：');
    regions.forEach((r, i) => {
        console.log(`    区域 ${i + 1}: 面积=${r.area}, 边界框=(${r.boundingBox.x},${r.boundingBox.y},${r.boundingBox.width}x${r.boundingBox.height}), 宽高比=${r.aspectRatio.toFixed(2)}, 填充率=${r.fillRatio.toFixed(2)}`);
    });
    
    // 区域筛选
    console.log('\n【步骤 3】区域筛选（筛选候选字符）');
    const candidateRegions = regions.filter(r => {
        return r.area >= 10 && r.aspectRatio >= 0.3 && r.aspectRatio <= 3.0;
    });
    console.log(`  筛选后保留 ${candidateRegions.length} 个候选字符区域`);
    
    const filteredImage = maskCandidateRegions(imageData, candidateRegions);
    // 投影分析
    console.log('\n【步骤 4】投影分析检测文字行');
    const projection = calculateHorizontalProjection(filteredImage);
    printProjection(projection, '水平投影');
    
    // 检测文字行
    const lines = detectTextLines(filteredImage, { minLineHeight: 5, projectionThreshold: 0.05 });
    console.log(`\n  检测到 ${lines.length} 行文字：`);
    lines.forEach((line, i) => {
        console.log(`    第 ${i + 1} 行: y=${line.y}, height=${line.height}`);
    });
    
    // 字符分割
    console.log('\n【步骤 5】字符分割（对每行使用垂直投影）');
    let allCharacters = [];
    
    lines.forEach((line, i) => {
        console.log(`\n  处理第 ${i + 1} 行 (y=${line.y}-${line.y + line.height}):`);
        
        // 计算该行的垂直投影
        const vertProj = new Array(line.width).fill(0);
        for (let x = 0; x < line.width; x++) {
            for (let y = line.y; y < line.y + line.height; y++) {
                const pixel = getPixel(filteredImage, line.x + x, y);
                if (pixel.r < 128) {
                    vertProj[x]++;
                }
            }
        }
        
        // 简化打印垂直投影
        const nonZero = vertProj.filter(v => v > 0);
        console.log(`    垂直投影非零位置数: ${nonZero.length}`);
        
        // 分割字符
        const chars = segmentCharacters(filteredImage, line, { minCharWidth: 3, gapThreshold: 0.0 });
        console.log(`    分割出 ${chars.length} 个字符：`);
        chars.forEach((c, j) => {
            console.log(`      字符 ${j + 1}: x=${c.x}-${c.x + c.width}, width=${c.width}`);
        });
        
        allCharacters = allCharacters.concat(chars);
    });
    
    // 字符排序
    console.log('\n【步骤 6】字符排序（按阅读顺序）');
    const sortedCharacters = sortCharacters(allCharacters);
    console.log(`  排序后的字符顺序：`);
    sortedCharacters.forEach((c, i) => {
        console.log(`    ${i + 1}. 位置 (${c.x}, ${c.y})`);
    });
    
    // RLSA 演示
    console.log('\n【步骤 7】RLSA 游程平滑算法演示');
    console.log('  RLSA 用于连接同一行的字符，形成文字行块');
    
    const rlsaResult = horizontalRLSA(imageData, 8);
    printImage(rlsaResult, 'RLSA 处理后（阈值=8，连接水平间隔≤8的前景像素）');
    
    // 对 RLSA 结果进行连通域分析
    const { numLabels: rlsaLabels } = labelConnectedComponents(rlsaResult);
    console.log(`  RLSA 后连通域数量: ${rlsaLabels}（原来: ${numLabels}）`);
    console.log('  同一行的字符被连接成一个文字块');
    
    console.log('【步骤8】投影末端与候选筛选边界');
    const lastPixel = createImageData(3,3,255,255,255);
    setPixel(lastPixel,2,2,0,0,0);
    console.log('末行单像素行：',detectTextLines(lastPixel,{minLineHeight:1,projectionThreshold:0}));
    console.log('末列单像素字：',segmentCharacters(lastPixel,{x:0,y:0,width:3,height:3},{minCharWidth:1,gapThreshold:0}));
    console.log('minArea过滤全部时，最终字符数量：',localizeText(imageData,{minArea:100000}).characters.length);
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('总结');
    console.log('='.repeat(60));
    console.log(`
文本区域定位完成！

处理流程：
1. 连通域分析 → 检测到 ${numLabels} 个区域
2. 区域筛选 → 保留 ${candidateRegions.length} 个候选字符
3. 投影分析 → 检测到 ${lines.length} 行文字
4. 字符分割 → 分割出 ${allCharacters.length} 个字符
5. 字符排序 → 按阅读顺序排列

可复用模块：
- horizontalRLSA(imageData, threshold) - 水平 RLSA
- verticalRLSA(imageData, threshold) - 垂直 RLSA
- detectTextLines(imageData, options) - 检测文字行
- segmentCharacters(imageData, lineRegion, options) - 分割字符
- sortCharacters(characters) - 排序字符
`);
}

// 运行主函数
if (require.main === module) main();
