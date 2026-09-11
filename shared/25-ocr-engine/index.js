/**
 * 第 25 章：把已经学过的图像操作连接成照片数字串识别流程。
 * 本模块不依赖 DOM、TensorFlow.js 或正确答案；分类器通过参数注入。
 * 节点式接口使测试能分别检查分割和分类，现场也能看到错误发生在哪个阶段。
 */
const { createImageData, cloneImageData } = require('../core');
const { grayscaleWeighted } = require('../03-grayscale');
const { binarizeOtsu, binarizeFixed } = require('../04-binarization');
const { medianFilter } = require('../05-denoising');
const { rotateImage, detectSkewAngle, calculateHorizontalProjection, calculateProjectionVariance } = require('../07-deskewing');
const { labelConnectedComponents, extractRegionProperties } = require('../09-connected-components');
const { resizeImage } = require('../11-feature-extraction');

// 包含本轮共享旋转/预处理修复。传递依赖改变时同步提升版本，避免同参数误归为旧流程。
const PIPELINE_VERSION = 'ocr-photo-v2-2026-09-11';

/** 校验外部 RGBA 图像，限制处理尺寸以避免意外的大图阻塞浏览器。 */
function validateImage(image) {
    if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
        image.width < 1 || image.height < 1 || image.width * image.height > 2000000 ||
        !image.data || image.data.length !== image.width * image.height * 4) {
        throw new Error('需要有效的 RGBA 图像，处理像素数不得超过 200 万；请先缩放照片。');
    }
}

/**
 * 利用积分图实现第 04 章的局部均值阈值。
 * 积分图 P(x,y) 存储左上矩形像素和，任意矩形只需四次查表，
 * 从 O(W H K²) 降到 O(W H)，阈值仍然是 localMean - offset。
 */
function adaptiveMeanFast(gray, blockSize = 41, offset = 8) {
    validateImage(gray);
    if (!Number.isInteger(blockSize) || blockSize < 3 || blockSize % 2 === 0 || !Number.isFinite(offset)) {
        throw new Error('窗口应为不小于 3 的奇数，偏移应为有限数值。');
    }
    const { width, height, data } = gray;
    const stride = width + 1;
    const integral = new Float64Array(stride * (height + 1));
    for (let y = 0; y < height; y++) {
        let row = 0;
        for (let x = 0; x < width; x++) {
            row += data[(y * width + x) * 4];
            integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
        }
    }
    const result = cloneImageData(gray);
    const half = Math.floor(blockSize / 2);
    for (let y = 0; y < height; y++) {
        const top = Math.max(0, y - half), bottom = Math.min(height, y + half + 1);
        for (let x = 0; x < width; x++) {
            const left = Math.max(0, x - half), right = Math.min(width, x + half + 1);
            const sum = integral[bottom * stride + right] - integral[top * stride + right]
                - integral[bottom * stride + left] + integral[top * stride + left];
            const mean = sum / ((right - left) * (bottom - top));
            const i = (y * width + x) * 4;
            const value = data[i] >= mean - offset ? 255 : 0;
            result.data[i] = result.data[i + 1] = result.data[i + 2] = value;
            result.data[i + 3] = 255;
        }
    }
    return result;
}

/** 将透明像素与白纸合成，再灰度化，避免透明背景被误读为黑色。 */
function flattenImage(image) {
    validateImage(image);
    const result = cloneImageData(image);
    for (let i = 0; i < result.data.length; i += 4) {
        const alpha = result.data[i + 3] / 255;
        for (let c = 0; c < 3; c++) result.data[i + c] = result.data[i + c] * alpha + 255 * (1 - alpha);
        result.data[i + 3] = 255;
    }
    return grayscaleWeighted(result);
}

/** 只统计前景，不把全白图的整个尺寸冒充有效包围框。 */
function foregroundBounds(image) {
    let left = image.width, top = image.height, right = -1, bottom = -1, count = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        if (image.data[(y * image.width + x) * 4] < 128) {
            left = Math.min(left, x); right = Math.max(right, x);
            top = Math.min(top, y); bottom = Math.max(bottom, y); count++;
        }
    }
    return count ? { x: left, y: top, width: right - left + 1, height: bottom - top + 1, count } : null;
}

/** 裁剪数据，不依赖 Canvas，也不修改原图。 */
function cropImage(image, box, padding = 0) {
    const x0 = Math.max(0, Math.floor(box.x - padding)), y0 = Math.max(0, Math.floor(box.y - padding));
    const x1 = Math.min(image.width, Math.ceil(box.x + box.width + padding));
    const y1 = Math.min(image.height, Math.ceil(box.y + box.height + padding));
    if (x1 <= x0 || y1 <= y0) throw new Error('裁剪区域为空');
    const result = createImageData(x1 - x0, y1 - y0);
    for (let y = 0; y < result.height; y++) {
        const start = ((y + y0) * image.width + x0) * 4;
        result.data.set(image.data.subarray(start, start + result.width * 4), y * result.width * 4);
    }
    return result;
}

/**
 * 先去除微小连通域，再按列投影分组。
 * 不能简单把每个连通域当成一个数字：数字的断笔可能形成多个连通域，
 * 只要它们的横向投影重叠，仍会属于同一字符区域。
 */
function segmentDigits(binary, options = {}) {
    validateImage(binary);
    const bounds = foregroundBounds(binary);
    if (!bounds) return { boxes: [], binary: cloneImageData(binary), bounds: null, warnings: [] };
    if (bounds.count / (binary.width * binary.height) > 0.55) {
        return { boxes: [], binary: cloneImageData(binary), bounds, warnings: ['前景面积过大，请检查白纸背景、裁剪范围或阈值。'] };
    }
    const labels = labelConnectedComponents(binary, 8);
    const regions = extractRegionProperties(labels.labels, labels.numLabels, binary.width, binary.height);
    const largest = regions.reduce((maximum, region) => Math.max(maximum, region.area), 0);
    const minArea = options.minArea ?? Math.max(3, Math.round(largest * 0.007));
    if (!Number.isFinite(minArea) || minArea < 1) throw new Error('最小笔画面积必须为正数');
    const kept = new Set(regions.filter(region => region.area >= minArea).map(region => region.label));
    const clean = createImageData(binary.width, binary.height);
    for (let i = 0; i < labels.labels.length; i++) {
        if (kept.has(labels.labels[i])) clean.data[i * 4] = clean.data[i * 4 + 1] = clean.data[i * 4 + 2] = 0;
    }
    const line = foregroundBounds(clean);
    if (!line) return { boxes: [], binary: clean, bounds: null, warnings: [] };
    const gap = options.mergeGap ?? Math.max(1, Math.round(line.height * 0.025));
    if (!Number.isInteger(gap) || gap < 0) throw new Error('笔画合并间隔必须为非负整数');
    const columns = new Uint32Array(clean.width);
    for (let y = line.y; y < line.y + line.height; y++) for (let x = line.x; x < line.x + line.width; x++) {
        if (clean.data[(y * clean.width + x) * 4] < 128) columns[x]++;
    }
    const intervals = [];
    let start = null, last = null;
    for (let x = line.x; x < line.x + line.width; x++) {
        if (!columns[x]) continue;
        if (start === null) start = x;
        else if (x - last - 1 > gap) { intervals.push([start, last + 1]); start = x; }
        last = x;
    }
    if (start !== null) intervals.push([start, last + 1]);
    const boxes = intervals.map(([left, right]) => {
        const sub = cropImage(clean, { x: left, y: line.y, width: right - left, height: line.height });
        const local = foregroundBounds(sub);
        return { x: left + local.x, y: line.y + local.y, width: local.width, height: local.height };
    });
    const warnings = [];
    if (boxes.some(box => box.width > box.height * 1.25)) warnings.push('有区域明显偏宽，可能存在数字粘连，请检查分割框。');
    if (line.x < 2 || line.y < 2 || line.x + line.width > binary.width - 2 || line.y + line.height > binary.height - 2) {
        warnings.push('笔画接近图片边缘，请确认整串数字已经拍全。');
    }
    return { boxes, binary: clean, bounds: line, warnings };
}

/**
 * 预处理照片。角度始终表示“对输入施加的校正角”，不是拍摄倾斜角。
 * 复用第 07 章角度搜索返回的实际旋转候选，避免重复取负导致越校越歪。
 */
function preprocessPhoto(image, options = {}) {
    let gray = flattenImage(image);
    if (options.denoise) gray = medianFilter(gray, 3);
    const method = options.thresholdMethod || 'otsu';
    const makeBinary = input => {
        if (method === 'otsu') return binarizeOtsu(input).imageData;
        if (method === 'adaptive') return adaptiveMeanFast(input, options.blockSize ?? 41, options.offset ?? 8);
        if (method === 'fixed') {
            const threshold = options.threshold ?? 128;
            if (!Number.isFinite(threshold) || threshold < 0 || threshold > 256) throw new Error('固定阈值应在 0–256');
            return binarizeFixed(input, threshold);
        }
        throw new Error('未知二值化方法');
    };
    let binary = makeBinary(gray);
    let correctionAngle = options.correctionAngle ?? 0;
    if (!Number.isFinite(correctionAngle) || Math.abs(correctionAngle) > 15) throw new Error('校正角度应在 -15° 到 15°');
    if (options.autoDeskew && correctionAngle === 0) {
        const bounds = foregroundBounds(binary);
        // 短串的字形本身会影响投影，不自动推断单个数字的“倾斜”。
        if (bounds && bounds.width > bounds.height * 2.5) {
            const scale = Math.min(1, 300 / binary.width);
            const small = resizeImage(binary, Math.max(1, Math.round(binary.width * scale)), Math.max(1, Math.round(binary.height * scale)));
            const baseline = calculateProjectionVariance(calculateHorizontalProjection(small));
            const detected = detectSkewAngle(small, { minAngle: -8, maxAngle: 8, step: 1, refine: false });
            if (detected.variance > baseline * 1.08) correctionAngle = detected.angle;
        }
    }
    if (correctionAngle !== 0) {
        gray = rotateImage(gray, correctionAngle, 'bilinear');
        binary = makeBinary(gray);
    }
    const segmentation = segmentDigits(binary, options);
    // 将已过滤的背景设为纯白，保留笔画处的灰度供模型读取。
    const inkGray = cloneImageData(gray);
    for (let i = 0; i < inkGray.data.length; i += 4) {
        if (segmentation.binary.data[i] === 255) inkGray.data[i] = inkGray.data[i + 1] = inkGray.data[i + 2] = 255;
    }
    return { gray, binary: segmentation.binary, inkGray, boxes: segmentation.boxes,
        bounds: segmentation.bounds, correctionAngle, warnings: segmentation.warnings };
}

/**
 * 识别入口；prepareDigit 和 predict 都由调用者注入。
 * predict(pixels, index) 返回长度 10 的分类得分，接口中不接收正确答案。
 */
async function recognizePhoto(image, { prepareDigit, predict, ...options } = {}) {
    if (typeof prepareDigit !== 'function' || typeof predict !== 'function') throw new Error('需要归一化函数和已加载模型的预测函数');
    const start = Date.now();
    const processed = preprocessPhoto(image, options);
    const characters = [];
    for (let index = 0; index < processed.boxes.length; index++) {
        const box = processed.boxes[index];
        const crop = cropImage(processed.inkGray, box, 1);
        const prepared = prepareDigit(crop);
        if (prepared.blank) throw new Error(`第 ${index + 1} 个分割区域在归一化后为空，请检查参数`);
        const scores = Array.from(await predict(prepared.pixels, index));
        if (scores.length !== 10 || scores.some(value => !Number.isFinite(value) || value < 0)) throw new Error('模型须返回 0–9 的 10 个有限非负得分');
        const candidates = scores.map((score, label) => ({ label: String(label), score })).sort((a, b) => b.score - a.score);
        characters.push({ box, label: candidates[0].label, score: candidates[0].score, candidates, normalized: prepared.imageData });
    }
    return { ...processed, pipelineVersion: PIPELINE_VERSION, characters, text: characters.map(item => item.label).join(''),
        status: characters.length ? 'recognized' : 'empty', elapsedMs: Date.now() - start };
}

module.exports = { PIPELINE_VERSION, validateImage, flattenImage, adaptiveMeanFast, foregroundBounds, cropImage, segmentDigits, preprocessPhoto, recognizePhoto };
