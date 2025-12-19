/**
 * 颜色转换模块
 * 
 * 提供各种颜色空间之间的转换函数
 * 
 * 来源：01. 数字图像基础
 */

const { clamp } = require('./utils');

/**
 * RGB 转十六进制颜色代码
 * 
 * 原理说明：
 * - 将每个通道值转换为两位十六进制
 * - 拼接成 #RRGGBB 格式
 * 
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {string} 十六进制颜色代码，如 "#FF0000"
 */
function rgbToHex(r, g, b) {
    const toHex = (value) => {
        const hex = clamp(Math.round(value), 0, 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * 十六进制颜色代码转 RGB
 * 
 * 原理说明：
 * - 解析十六进制字符串
 * - 支持 #RGB 简写和 #RRGGBB 完整格式
 * 
 * @param {string} hex - 十六进制颜色代码，如 "#FF0000" 或 "FF0000"
 * @returns {{r: number, g: number, b: number}} RGB 值
 */
function hexToRgb(hex) {
    // 移除 # 前缀
    hex = hex.replace(/^#/, '');
    
    // 处理简写形式 (如 "F00" -> "FF0000")
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}

/**
 * RGB 转灰度值
 * 
 * 原理说明：
 * - 使用标准加权公式（ITU-R BT.601）
 * - Gray = 0.299R + 0.587G + 0.114B
 * - 权重基于人眼对不同颜色的敏感度
 * - 绿色权重最大，因为人眼对绿色最敏感
 * 
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {number} 灰度值 (0-255)
 */
function rgbToGray(r, g, b) {
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * RGB 转 HSV
 * 
 * 原理说明：
 * - H (Hue): 色相，0-360度
 * - S (Saturation): 饱和度，0-100%
 * - V (Value): 明度，0-100%
 * - 常用于颜色选择器和图像分割
 * 
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {{h: number, s: number, v: number}} HSV 值 (h: 0-360, s: 0-100, v: 0-100)
 */
function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    let s = max === 0 ? 0 : diff / max;
    let v = max;
    
    if (diff !== 0) {
        if (max === r) {
            h = 60 * (((g - b) / diff) % 6);
        } else if (max === g) {
            h = 60 * ((b - r) / diff + 2);
        } else {
            h = 60 * ((r - g) / diff + 4);
        }
    }
    
    if (h < 0) h += 360;
    
    return {
        h: Math.round(h),
        s: Math.round(s * 100),
        v: Math.round(v * 100)
    };
}

module.exports = {
    rgbToHex,
    hexToRgb,
    rgbToGray,
    rgbToHsv
};
