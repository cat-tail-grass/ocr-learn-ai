'use strict';

const NEG = -Infinity;
function logAdd(...values) {
    const m = Math.max(...values);
    return m === NEG ? NEG : m + Math.log(values.reduce((s, x) => s + Math.exp(x - m), 0));
}

function validateMatrix(rows, probability = true) {
    if (!Array.isArray(rows) || !rows.length || !Array.isArray(rows[0]) || rows[0].length < 2) {
        throw new TypeError('输入必须是非空 T×K 矩阵，K≥2（包含 blank）');
    }
    const K = rows[0].length;
    for (const row of rows) {
        if (!Array.isArray(row) || row.length !== K || Array.from(row).some(x => !Number.isFinite(x)
            || (probability && (x < 0 || x > 1)))) throw new TypeError('矩阵必须矩形且含合法有限数值');
        if (probability && Math.abs(row.reduce((a, b) => a + b, 0) - 1) > 1e-6) {
            throw new RangeError('每个时间步的概率和必须为 1');
        }
    }
    return { T: rows.length, K };
}

function validateBlank(blank, K) {
    if (!Number.isInteger(blank) || blank < 0 || blank >= K) throw new RangeError('blank 索引越界');
}

function validateTarget(target, K, blank) {
    validateBlank(blank, K);
    if (!Array.isArray(target) || Array.from(target).some(x => !Number.isInteger(x) || x < 0 || x >= K || x === blank)) {
        throw new TypeError('target 必须为不含 blank 的合法类别索引数组');
    }
}

function minimumFrames(target) {
    if (!Array.isArray(target) || Array.from(target).some(x => !Number.isInteger(x) || x < 0)) throw new TypeError('target 必须为非负整数数组');
    return target.length + target.slice(1).filter((x, i) => x === target[i]).length;
}

function collapsePath(path, blank = 0) {
    if (!Number.isInteger(blank) || blank < 0 || !Array.isArray(path)
        || Array.from(path).some(x => !Number.isInteger(x) || x < 0)) throw new TypeError('路径和 blank 必须为非负整数');
    const labels = [];
    for (let t = 0; t < path.length; t++) {
        const current = path[t];
        const sameAsPreviousFrame = t > 0 && current === path[t - 1];
        if (current !== blank && !sameAsPreviousFrame) {
            labels.push(current);
        }
    }
    return labels;
}

function greedyDecode(probabilities, blank = 0) {
    const { K } = validateMatrix(probabilities); validateBlank(blank, K);
    const path = probabilities.map(row => row.reduce((best, x, i) => x > row[best] ? i : best, 0));
    const logProbability = path.reduce((s, x, t) => s + Math.log(probabilities[t][x]), 0);
    return { path, labels: collapsePath(path, blank), logProbability };
}

// alpha 含当前帧发射；beta 仅含未来帧发射，避免后验重复除以当前概率。
function fromLogProbabilities(logp, target, blank = 0) {
    const T = logp.length, K = logp[0].length;
    validateTarget(target, K, blank);
    const extended = [blank];
    for (const label of target) {
        extended.push(label, blank);
    }
    const S = extended.length;
    const alpha = Array.from({ length: T }, () => Array(S).fill(NEG));
    alpha[0][0] = logp[0][blank];
    if (S > 1) alpha[0][1] = logp[0][extended[1]];
    const canSkip = s => s >= 2 && extended[s] !== blank && extended[s] !== extended[s - 2];
    for (let t = 1; t < T; t++) {
        for (let s = 0; s < S; s++) {
            const stay = alpha[t - 1][s];
            const advance = s > 0 ? alpha[t - 1][s - 1] : NEG;
            const skip = canSkip(s) ? alpha[t - 1][s - 2] : NEG;
            alpha[t][s] = logp[t][extended[s]] + logAdd(stay, advance, skip);
        }
    }
    const logProbability = logAdd(alpha[T - 1][S - 1], S > 1 ? alpha[T - 1][S - 2] : NEG);
    const beta = Array.from({ length: T }, () => Array(S).fill(NEG));
    beta[T - 1][S - 1] = 0;
    if (S > 1) beta[T - 1][S - 2] = 0;
    for (let t = T - 2; t >= 0; t--) {
        for (let s = 0; s < S; s++) {
            const stay = beta[t + 1][s] + logp[t + 1][extended[s]];
            const advance = s + 1 < S ? beta[t + 1][s + 1] + logp[t + 1][extended[s + 1]] : NEG;
            const skip = s + 2 < S && canSkip(s + 2)
                ? beta[t + 1][s + 2] + logp[t + 1][extended[s + 2]] : NEG;
            beta[t][s] = logAdd(stay, advance, skip);
        }
    }
    const posterior = Array.from({ length: T }, () => Array(K).fill(0));
    if (logProbability !== NEG) {
        for (let t = 0; t < T; t++) {
            for (let s = 0; s < S; s++) {
                const statePosterior = Math.exp(alpha[t][s] + beta[t][s] - logProbability);
                posterior[t][extended[s]] += statePosterior;
            }
        }
    }
    return { loss: -logProbability, probability: Math.exp(logProbability), logProbability,
        possible: logProbability !== NEG, minimumFrames: minimumFrames(target), extended, alpha, beta, posterior };
}

function ctcForwardBackward(probabilities, target, blank = 0) {
    validateMatrix(probabilities);
    return fromLogProbabilities(probabilities.map(row => row.map(Math.log)), target, blank);
}

function ctcLossAndGradient(logits, target, blank = 0) {
    validateMatrix(logits, false);
    const logp = logits.map(row => {
        // 先移去公共大偏移，避免 x - (max + logSum) 中的小归一化项被舍入吞掉。
        // 与 TF.js logSoftmax 一致：shifted - log(sum(exp(shifted)))。
        const max = Math.max(...row);
        const shifted = row.map(x => x - max);
        const logNormalizer = logAdd(...shifted);
        return shifted.map(x => x - logNormalizer);
    });
    const result = fromLogProbabilities(logp, target, blank);
    if (!result.possible) throw new RangeError(`CTC 无合法对齐：至少需要 ${result.minimumFrames} 帧`);
    const probabilities = logp.map(row => row.map(Math.exp));
    const gradient = probabilities.map((row, t) => row.map((p, k) => p - result.posterior[t][k]));
    return { ...result, probabilities, gradient };
}

// 仅用于独立校验的小规模全枚举：不调用动态规划。
function enumeratePaths(probabilities, target, blank = 0, maxPaths = 1000000) {
    const { T, K } = validateMatrix(probabilities); validateTarget(target, K, blank);
    if (!Number.isInteger(maxPaths) || maxPaths < 1 || K ** T > maxPaths) throw new RangeError('枚举路径超出限制');
    let probability = 0, matchingPaths = 0;
    const distribution = new Map();
    function visit(path, p) {
        if (path.length === T) {
            const labels = collapsePath(path, blank), key = JSON.stringify(labels);
            distribution.set(key, (distribution.get(key) || 0) + p);
            if (labels.length === target.length && labels.every((x, i) => x === target[i])) {
                probability += p;
                matchingPaths++;
            }
            return;
        }
        for (let k = 0; k < K; k++) {
            const nextProbability = p * probabilities[path.length][k];
            visit(path.concat(k), nextProbability);
        }
    }
    visit([], 1);
    return { probability, matchingPaths, totalPaths: K ** T,
        distribution: [...distribution].map(([key, p]) => ({ labels: JSON.parse(key), probability: p })) };
}

function prefixBeamDecode(probabilities, blank = 0, beamWidth = 10) {
    const { K } = validateMatrix(probabilities); validateBlank(blank, K);
    if (!Number.isInteger(beamWidth) || beamWidth < 1) throw new RangeError('beamWidth 必须为正整数');
    let beam = [{ labels: [], pb: 0, pnb: NEG }];
    for (const row of probabilities) {
        const next = new Map();
        function add(labels, kind, value) {
            if (value === NEG) {
                return;
            }
            const key = JSON.stringify(labels);
            if (!next.has(key)) {
                next.set(key, { labels, pb: NEG, pnb: NEG });
            }
            const item = next.get(key);
            item[kind] = logAdd(item[kind], value);
        }
        for (const item of beam) {
            const total = logAdd(item.pb, item.pnb), last = item.labels[item.labels.length - 1];
            add(item.labels, 'pb', total + Math.log(row[blank]));
            for (let k = 0; k < K; k++) {
                if (k === blank) {
                    continue;
                }
                const lp = Math.log(row[k]);
                if (k === last) {
                    add(item.labels, 'pnb', item.pnb + lp); // 未经过 blank，同一个字符持续发射。
                    add(item.labels.concat(k), 'pnb', item.pb + lp); // blank 后允许新增相同字符。
                } else {
                    add(item.labels.concat(k), 'pnb', total + lp);
                }
            }
        }
        beam = [...next.values()].sort((a, b) => logAdd(b.pb, b.pnb) - logAdd(a.pb, a.pnb)
            || JSON.stringify(a.labels).localeCompare(JSON.stringify(b.labels))).slice(0, beamWidth);
    }
    return beam.map(item => ({ labels: item.labels, logProbability: logAdd(item.pb, item.pnb),
        probability: Math.exp(logAdd(item.pb, item.pnb)) }));
}

// 无虚构 tf.ctcLoss API；读取 logits 后使用已验证的解析一阶梯度回接计算图。
// dataSync 会同步到 JS，适合小型 CPU 教学实验，不是高吞吐 GPU CTC 内核。
function differentiableCtcLoss(tf, logits, targets, blank = 0) {
    if (logits.rank !== 3 || logits.shape.some(x => x < 1) || !Array.isArray(targets)
        || targets.length !== logits.shape[0]) throw new TypeError('需要 [B,T,K] logits 与 B 个标签序列');
    const [B, T, K] = logits.shape;
    for (const target of targets) validateTarget(target, K, blank);
    const operation = tf.customGrad((input, save) => {
        const values = input.dataSync(), gradients = new Float32Array(values.length);
        let loss = 0;
        for (let b = 0; b < B; b++) {
            const rows = Array.from({ length: T }, (_, t) => Array.from(values.slice((b * T + t) * K, (b * T + t + 1) * K)));
            const result = ctcLossAndGradient(rows, targets[b], blank);
            loss += result.loss / B;
            for (let t = 0; t < T; t++) {
                for (let k = 0; k < K; k++) {
                    gradients[(b * T + t) * K + k] = result.gradient[t][k] / B;
                }
            }
        }
        save([tf.tensor(gradients, [B, T, K])]);
        return { value: tf.scalar(loss), gradFunc: (dy, saved) => [saved[0].mul(dy)] };
    });
    return operation(logits);
}

module.exports = { logAdd, minimumFrames, collapsePath, greedyDecode, ctcForwardBackward,
    ctcLossAndGradient, enumeratePaths, prefixBeamDecode, differentiableCtcLoss };
