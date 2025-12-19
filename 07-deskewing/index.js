/**
 * 07. 倾斜校正 (Deskewing / Skew Correction)
 * 
 * 本文件演示倾斜校正的核心算法实现：
 * 1. 投影分析法检测倾斜角度
 * 2. 霍夫变换检测直线（简化版）
 * 3. 仿射变换实现图像旋转
 * 4. 双线性插值处理旋转后的像素值
 * 
 * 运行方式：node index.js
 */

// 引入共享工具模块
const {
    MockImageData,
    getPixel,
    setPixel,
    cloneImageData,
    createImageData,
    binarizeFixed,
    clamp
} = require('../shared/imageUtils');

// ==================== 投影分析相关函数 ====================

/**
 * 函数名称：calculateHorizontalProjection
 * 功能说明：计算图像的水平投影直方图
 * 
 * 原理解释：
 * - 水平投影是统计每一行中前景（黑色）像素的数量
 * - 结果是一个一维数组，长度等于图像高度
 * - 用于分析文字行的分布规律
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @returns {number[]} 水平投影数组，索引为行号，值为该行黑色像素数
 */
function calculateHorizontalProjection(imageData) {
    const { width, height } = imageData;
    const projection = new Array(height).fill(0);
    
    // Step 1: 遍历每一行
    for (let y = 0; y < height; y++) {
        let blackCount = 0;
        
        // Step 2: 统计该行的黑色像素数量
        for (let x = 0; x < width; x++) {
            const pixel = getPixel(imageData, x, y);
            // 假设黑色是前景（文字），白色是背景
            // 在二值图中，黑色像素值为 0
            if (pixel.r < 128) {
                blackCount++;
            }
        }
        
        projection[y] = blackCount;
    }
    
    return projection;
}

/**
 * 函数名称：calculateProjectionVariance
 * 功能说明：计算投影直方图的方差
 * 
 * 原理解释：
 * - 方差反映数据的离散程度
 * - 当文档水平时，水平投影会有明显的峰（文字行）和谷（行间距）
 * - 这种峰谷分布使得方差较大
 * - 当文档倾斜时，峰谷变得模糊，方差减小
 * 
 * @param {number[]} projection - 投影直方图
 * @returns {number} 方差值
 */
function calculateProjectionVariance(projection) {
    const n = projection.length;
    
    if (n === 0) return 0;
    
    // Step 1: 计算均值
    const sum = projection.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;
    
    // Step 2: 计算方差
    // 方差 = Σ(xi - μ)² / n
    let variance = 0;
    for (let i = 0; i < n; i++) {
        const diff = projection[i] - mean;
        variance += diff * diff;
    }
    variance /= n;
    
    return variance;
}

/**
 * 函数名称：detectSkewAngleByProjection
 * 功能说明：使用投影分析法检测倾斜角度
 * 
 * 原理解释：
 * - 将图像旋转不同角度
 * - 对每个角度计算水平投影的方差
 * - 方差最大的角度即为倾斜角度
 * - 因为当文档恢复水平时，文字行会形成最明显的峰谷
 * 
 * 算法优化：
 * - 第一阶段：粗搜索（大步长）
 * - 第二阶段：在最佳角度附近细化搜索
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {object} options - 配置选项
 * @param {number} options.minAngle - 最小搜索角度（默认 -15）
 * @param {number} options.maxAngle - 最大搜索角度（默认 15）
 * @param {number} options.step - 搜索步长（默认 1）
 * @param {boolean} options.refine - 是否进行细化搜索（默认 true）
 * @param {number} options.refineStep - 细化搜索步长（默认 0.1）
 * @returns {{angle: number, variance: number, allResults: Array}} 检测结果
 */
function detectSkewAngleByProjection(imageData, options = {}) {
    const {
        minAngle = -15,
        maxAngle = 15,
        step = 1,
        refine = true,
        refineStep = 0.1
    } = options;
    
    const allResults = [];
    let bestAngle = 0;
    let maxVariance = 0;
    
    console.log(`[投影分析] 开始粗搜索: ${minAngle}° 到 ${maxAngle}°, 步长 ${step}°`);
    
    // Stage 1: 粗搜索
    for (let angle = minAngle; angle <= maxAngle; angle += step) {
        // 旋转图像
        const rotated = rotateImage(imageData, angle);
        
        // 计算水平投影
        const projection = calculateHorizontalProjection(rotated);
        
        // 计算投影方差
        const variance = calculateProjectionVariance(projection);
        
        allResults.push({ angle, variance });
        
        // 更新最佳角度
        if (variance > maxVariance) {
            maxVariance = variance;
            bestAngle = angle;
        }
    }
    
    console.log(`[投影分析] 粗搜索最佳角度: ${bestAngle}°, 方差: ${maxVariance.toFixed(2)}`);
    
    // Stage 2: 细化搜索
    if (refine && step > refineStep) {
        const refineMin = bestAngle - step;
        const refineMax = bestAngle + step;
        
        console.log(`[投影分析] 开始细化搜索: ${refineMin}° 到 ${refineMax}°, 步长 ${refineStep}°`);
        
        for (let angle = refineMin; angle <= refineMax; angle += refineStep) {
            // 跳过已经搜索过的角度
            if (Math.abs(angle - bestAngle) < 0.001) continue;
            
            const rotated = rotateImage(imageData, angle);
            const projection = calculateHorizontalProjection(rotated);
            const variance = calculateProjectionVariance(projection);
            
            allResults.push({ angle, variance });
            
            if (variance > maxVariance) {
                maxVariance = variance;
                bestAngle = angle;
            }
        }
        
        console.log(`[投影分析] 细化后最佳角度: ${bestAngle.toFixed(2)}°, 方差: ${maxVariance.toFixed(2)}`);
    }
    
    return {
        angle: bestAngle,
        variance: maxVariance,
        allResults: allResults.sort((a, b) => a.angle - b.angle)
    };
}

// ==================== 图像旋转相关函数 ====================

/**
 * 函数名称：rotateImage
 * 功能说明：旋转图像指定角度
 * 
 * 原理解释：
 * - 使用仿射变换进行旋转
 * - 绕图像中心点旋转
 * - 使用逆变换 + 双线性插值计算像素值
 * 
 * 逆变换公式：
 * x_src = (x_dst - cx) * cos(θ) + (y_dst - cy) * sin(θ) + cx
 * y_src = -(x_dst - cx) * sin(θ) + (y_dst - cy) * cos(θ) + cy
 * 
 * @param {ImageData|MockImageData} imageData - 原始图像数据
 * @param {number} angleDegrees - 旋转角度（度），正值为逆时针
 * @param {string} interpolation - 插值方法：'nearest' 或 'bilinear'（默认）
 * @param {number} backgroundColor - 背景填充颜色（默认255白色）
 * @returns {MockImageData} 旋转后的图像数据
 */
function rotateImage(imageData, angleDegrees, interpolation = 'bilinear', backgroundColor = 255) {
    const { width, height } = imageData;
    
    // 创建结果图像（保持原尺寸）
    const result = createImageData(width, height, backgroundColor, backgroundColor, backgroundColor);
    
    // 计算图像中心
    const cx = width / 2;
    const cy = height / 2;
    
    // 将角度转换为弧度
    // 注意：数学上逆时针为正，但我们希望正角度表示顺时针校正
    // 所以这里取负值
    const angleRadians = -angleDegrees * Math.PI / 180;
    
    // 预计算三角函数值（性能优化）
    const cosA = Math.cos(angleRadians);
    const sinA = Math.sin(angleRadians);
    
    // 遍历目标图像的每个像素
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // 使用逆变换计算源图像坐标
            // 将坐标相对于中心点表示
            const dx = x - cx;
            const dy = y - cy;
            
            // 逆旋转变换
            const srcX = dx * cosA + dy * sinA + cx;
            const srcY = -dx * sinA + dy * cosA + cy;
            
            // 检查源坐标是否在图像范围内
            if (srcX >= 0 && srcX < width - 1 && srcY >= 0 && srcY < height - 1) {
                let pixelValue;
                
                if (interpolation === 'bilinear') {
                    // 双线性插值
                    pixelValue = bilinearInterpolate(imageData, srcX, srcY);
                } else {
                    // 最近邻插值
                    const nearestX = Math.round(srcX);
                    const nearestY = Math.round(srcY);
                    const pixel = getPixel(imageData, nearestX, nearestY);
                    pixelValue = pixel.r;
                }
                
                setPixel(result, x, y, pixelValue, pixelValue, pixelValue);
            }
            // 超出范围的像素保持背景色
        }
    }
    
    return result;
}

/**
 * 函数名称：bilinearInterpolate
 * 功能说明：使用双线性插值计算非整数坐标的像素值
 * 
 * 原理解释：
 * - 使用周围4个像素的加权平均
 * - 权重根据距离计算
 * - 结果比最近邻插值更平滑
 * 
 *     x1        x2
 *   ┌───┬───────┬───┐
 * y1│ Q11│       │Q12│
 *   ├───┼───●───┼───┤  ← (x, y) 落在这里
 *   │   │ (x,y) │   │
 * y2│ Q21│       │Q22│
 *   └───┴───────┴───┘
 * 
 * @param {ImageData|MockImageData} imageData - 图像数据
 * @param {number} x - X坐标（可以是小数）
 * @param {number} y - Y坐标（可以是小数）
 * @returns {number} 插值后的灰度值
 */
function bilinearInterpolate(imageData, x, y) {
    // 获取四个角点的坐标
    const x1 = Math.floor(x);
    const x2 = x1 + 1;
    const y1 = Math.floor(y);
    const y2 = y1 + 1;
    
    // 计算小数部分（权重因子）
    const xFrac = x - x1;
    const yFrac = y - y1;
    
    // 获取四个角点的像素值
    const q11 = getPixel(imageData, x1, y1).r;
    const q12 = getPixel(imageData, x2, y1).r;
    const q21 = getPixel(imageData, x1, y2).r;
    const q22 = getPixel(imageData, x2, y2).r;
    
    // 双线性插值公式
    // 先在 x 方向插值
    const r1 = q11 * (1 - xFrac) + q12 * xFrac;
    const r2 = q21 * (1 - xFrac) + q22 * xFrac;
    
    // 再在 y 方向插值
    const result = r1 * (1 - yFrac) + r2 * yFrac;
    
    return Math.round(result);
}

// ==================== 霍夫变换相关函数 ====================

/**
 * 函数名称：houghTransform
 * 功能说明：使用霍夫变换检测图像中的直线
 * 
 * 原理解释：
 * - 直线的极坐标表示：ρ = x·cos(θ) + y·sin(θ)
 * - 图像空间的一个点对应参数空间的一条曲线
 * - 共线的点在参数空间会交于一点
 * - 累加器中的峰值对应图像中的直线
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {object} options - 配置选项
 * @param {number} options.thetaStep - 角度步长（默认 1 度）
 * @param {number} options.rhoStep - 距离步长（默认 1 像素）
 * @param {number} options.threshold - 累加阈值（默认为像素总数的 1%）
 * @returns {{lines: Array, accumulator: Array}} 检测到的直线和累加器
 */
function houghTransform(imageData, options = {}) {
    const { width, height } = imageData;
    const {
        thetaStep = 1,
        rhoStep = 1
    } = options;
    
    // 计算对角线长度（ρ的最大值）
    const diagonal = Math.sqrt(width * width + height * height);
    
    // 累加器维度
    const thetaRange = 180; // 0° 到 179°
    const rhoRange = Math.ceil(diagonal * 2 / rhoStep);
    
    // 初始化累加器
    const accumulator = [];
    for (let t = 0; t < thetaRange / thetaStep; t++) {
        accumulator.push(new Array(rhoRange).fill(0));
    }
    
    // 预计算三角函数值
    const cosTheta = [];
    const sinTheta = [];
    for (let t = 0; t < thetaRange; t += thetaStep) {
        const rad = t * Math.PI / 180;
        cosTheta.push(Math.cos(rad));
        sinTheta.push(Math.sin(rad));
    }
    
    // 遍历所有前景像素
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixel = getPixel(imageData, x, y);
            
            // 只处理前景像素（黑色）
            if (pixel.r < 128) {
                // 对每个可能的角度
                for (let tIdx = 0; tIdx < cosTheta.length; tIdx++) {
                    // 计算 ρ
                    const rho = x * cosTheta[tIdx] + y * sinTheta[tIdx];
                    
                    // 将 ρ 映射到累加器索引
                    const rhoIdx = Math.round((rho + diagonal) / rhoStep);
                    
                    if (rhoIdx >= 0 && rhoIdx < rhoRange) {
                        accumulator[tIdx][rhoIdx]++;
                    }
                }
            }
        }
    }
    
    return { accumulator, thetaStep, rhoStep, diagonal };
}

/**
 * 函数名称：detectSkewAngleByHough
 * 功能说明：使用霍夫变换检测倾斜角度
 * 
 * 原理解释：
 * - 文档中的文字行形成接近水平的直线
 * - 在霍夫空间中，这些直线对应特定角度的累加峰值
 * - 统计累加器中峰值对应的角度
 * - 最频繁出现的角度即为文档的主方向
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {object} options - 配置选项
 * @returns {{angle: number, confidence: number}} 检测结果
 */
function detectSkewAngleByHough(imageData, options = {}) {
    console.log('[霍夫变换] 开始检测...');
    
    // 执行霍夫变换
    const { accumulator, thetaStep, diagonal } = houghTransform(imageData, options);
    
    // 统计每个角度的累加总和
    const angleSums = [];
    for (let tIdx = 0; tIdx < accumulator.length; tIdx++) {
        const theta = tIdx * thetaStep;
        const sum = accumulator[tIdx].reduce((a, b) => a + b, 0);
        angleSums.push({ theta, sum });
    }
    
    // 找到水平方向附近（85°-95°）累加最大的角度
    // 在霍夫变换中，水平线对应 θ ≈ 90°
    const horizontalRange = angleSums.filter(a => a.theta >= 80 && a.theta <= 100);
    const bestAngle = horizontalRange.reduce((best, curr) => 
        curr.sum > best.sum ? curr : best
    );
    
    // 计算倾斜角度（相对于90°的偏移）
    const skewAngle = 90 - bestAngle.theta;
    
    console.log(`[霍夫变换] 检测到主方向: ${bestAngle.theta}°`);
    console.log(`[霍夫变换] 倾斜角度: ${skewAngle}°`);
    
    return {
        angle: skewAngle,
        detectedTheta: bestAngle.theta,
        sum: bestAngle.sum
    };
}

// ==================== 完整的倾斜校正函数 ====================

/**
 * 函数名称：deskew
 * 功能说明：执行完整的倾斜校正
 * 
 * 原理解释：
 * - 首先检测倾斜角度（使用投影分析法或霍夫变换）
 * - 然后使用仿射变换旋转图像
 * - 返回校正后的图像和检测信息
 * 
 * @param {ImageData|MockImageData} imageData - 二值图像数据
 * @param {object} options - 配置选项
 * @param {string} options.method - 检测方法：'projection'（默认）或 'hough'
 * @param {string} options.interpolation - 插值方法：'bilinear'（默认）或 'nearest'
 * @returns {{imageData: MockImageData, angle: number, method: string}} 校正结果
 */
function deskew(imageData, options = {}) {
    const {
        method = 'projection',
        interpolation = 'bilinear'
    } = options;
    
    console.log(`\n========== 开始倾斜校正 ==========`);
    console.log(`检测方法: ${method}`);
    console.log(`插值方法: ${interpolation}`);
    
    let angle, detectionResult;
    
    // Step 1: 检测倾斜角度
    if (method === 'hough') {
        detectionResult = detectSkewAngleByHough(imageData, options);
        angle = detectionResult.angle;
    } else {
        detectionResult = detectSkewAngleByProjection(imageData, options);
        angle = detectionResult.angle;
    }
    
    console.log(`\n检测到的倾斜角度: ${angle.toFixed(2)}°`);
    
    // Step 2: 旋转图像进行校正
    // 校正方向与倾斜方向相反
    const correctionAngle = -angle;
    console.log(`校正角度: ${correctionAngle.toFixed(2)}°`);
    
    const correctedImage = rotateImage(imageData, correctionAngle, interpolation);
    
    console.log(`========== 倾斜校正完成 ==========\n`);
    
    return {
        imageData: correctedImage,
        angle: angle,
        correctionAngle: correctionAngle,
        method: method,
        detectionResult: detectionResult
    };
}

// ==================== 演示代码 ====================

/**
 * 创建模拟的倾斜文档图像
 * 用于测试倾斜检测和校正算法
 */
function createTestImage() {
    const width = 200;
    const height = 150;
    const image = createImageData(width, height, 255, 255, 255);
    
    // 创建几行"文字"（用黑色矩形模拟）
    const lines = [
        { y: 30, width: 150 },
        { y: 50, width: 120 },
        { y: 70, width: 160 },
        { y: 90, width: 100 },
        { y: 110, width: 140 }
    ];
    
    // 绘制水平文字行
    for (const line of lines) {
        const startX = (width - line.width) / 2;
        for (let x = startX; x < startX + line.width; x++) {
            for (let dy = 0; dy < 8; dy++) { // 文字行高度8像素
                const y = line.y + dy;
                if (y >= 0 && y < height && x >= 0 && x < width) {
                    setPixel(image, Math.floor(x), y, 0, 0, 0);
                }
            }
        }
    }
    
    return image;
}

/**
 * 演示主函数
 */
function demo() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          07. 倾斜校正 (Deskewing) - Node.js 演示           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // 1. 创建测试图像
    console.log('【步骤1】创建测试图像');
    const original = createTestImage();
    console.log(`创建了 ${original.width}×${original.height} 的测试图像（模拟文档）\n`);
    
    // 2. 模拟倾斜
    const skewAngle = 5; // 5度倾斜
    console.log(`【步骤2】模拟 ${skewAngle}° 倾斜`);
    const skewed = rotateImage(original, skewAngle);
    console.log('图像已旋转，模拟倾斜效果\n');
    
    // 3. 计算原始图像的投影方差
    console.log('【步骤3】分析原始图像的水平投影');
    const originalProjection = calculateHorizontalProjection(original);
    const originalVariance = calculateProjectionVariance(originalProjection);
    console.log(`原始图像投影方差: ${originalVariance.toFixed(2)}`);
    
    // 4. 计算倾斜图像的投影方差
    console.log('\n【步骤4】分析倾斜图像的水平投影');
    const skewedProjection = calculateHorizontalProjection(skewed);
    const skewedVariance = calculateProjectionVariance(skewedProjection);
    console.log(`倾斜图像投影方差: ${skewedVariance.toFixed(2)}`);
    console.log(`方差变化: ${((skewedVariance / originalVariance) * 100).toFixed(1)}%`);
    console.log('（方差减小说明峰谷变模糊，这是倾斜的特征）\n');
    
    // 5. 检测倾斜角度
    console.log('【步骤5】使用投影分析法检测倾斜角度');
    const detection = detectSkewAngleByProjection(skewed, {
        minAngle: -10,
        maxAngle: 10,
        step: 1,
        refine: true,
        refineStep: 0.1
    });
    console.log(`\n检测结果: ${detection.angle.toFixed(2)}°`);
    console.log(`实际倾斜: ${skewAngle}°`);
    console.log(`误差: ${Math.abs(detection.angle - skewAngle).toFixed(2)}°\n`);
    
    // 6. 执行倾斜校正
    console.log('【步骤6】执行倾斜校正');
    const corrected = deskew(skewed, {
        method: 'projection',
        interpolation: 'bilinear',
        minAngle: -10,
        maxAngle: 10,
        step: 1,
        refine: true
    });
    
    // 7. 验证校正效果
    console.log('【步骤7】验证校正效果');
    const correctedProjection = calculateHorizontalProjection(corrected.imageData);
    const correctedVariance = calculateProjectionVariance(correctedProjection);
    console.log(`校正后投影方差: ${correctedVariance.toFixed(2)}`);
    console.log(`相比倾斜图像改善: ${((correctedVariance / skewedVariance - 1) * 100).toFixed(1)}%\n`);
    
    // 8. 演示插值方法对比
    console.log('【步骤8】插值方法对比');
    console.log('最近邻插值：速度快，但有锯齿');
    console.log('双线性插值：结果平滑，推荐使用');
    
    const startNearest = Date.now();
    rotateImage(skewed, 5, 'nearest');
    const timeNearest = Date.now() - startNearest;
    
    const startBilinear = Date.now();
    rotateImage(skewed, 5, 'bilinear');
    const timeBilinear = Date.now() - startBilinear;
    
    console.log(`最近邻插值耗时: ${timeNearest}ms`);
    console.log(`双线性插值耗时: ${timeBilinear}ms\n`);
    
    // 9. 总结
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                        算法总结                             ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ 1. 投影分析法：适合规整文档，计算简单，精度高               ║');
    console.log('║ 2. 霍夫变换：适合有明显直线特征的图像，较复杂               ║');
    console.log('║ 3. 图像旋转：使用逆变换+双线性插值，效果最佳               ║');
    console.log('║ 4. OCR预处理：倾斜校正是提高识别率的重要步骤               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
}

// 运行演示
demo();

// 导出函数供其他模块使用
module.exports = {
    calculateHorizontalProjection,
    calculateProjectionVariance,
    detectSkewAngleByProjection,
    rotateImage,
    bilinearInterpolate,
    houghTransform,
    detectSkewAngleByHough,
    deskew
};

