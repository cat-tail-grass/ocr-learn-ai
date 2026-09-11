/**
 * 工具函数模块
 * 
 * 提供基础的数学和辅助函数
 * 
 * 来源：01-02. 数字图像基础 / JavaScript 图像处理基础
 */

/**
 * 限制值在指定范围内
 * 
 * 原理说明：
 * - 确保值不会超出有效范围
 * - 常用于像素值限制在 0-255
 * 
 * @param {number} value - 要限制的值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 线性插值
 * 
 * 原理说明：
 * - 在两个值之间进行线性插值
 * - 公式：result = a + (b - a) * t
 * - t = 0 时返回 a，t = 1 时返回 b
 * 
 * @param {number} a - 起始值
 * @param {number} b - 结束值
 * @param {number} t - 插值比例 (0-1)
 * @returns {number} 插值结果
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/** 可复现教学实验用的 32-bit LCG；返回 [0,1)，不用于安全用途。 */
function createSeededRandom(seed = 20260911) {
    if (!Number.isInteger(seed)) throw new TypeError('seed 必须为整数');
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

module.exports = {
    createSeededRandom,
    clamp,
    lerp
};
