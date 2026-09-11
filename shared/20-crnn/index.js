'use strict';

const { differentiableCtcLoss, ctcLossAndGradient, greedyDecode, prefixBeamDecode } = require('../19-ctc-loss');
const DEFAULT_CONFIG = Object.freeze({ height: 8, width: 20, channels: 4, hiddenSize: 8, classes: 3, seed: 20260908 });
const ALPHABET = Object.freeze(['', '0', '1']); // blank=0，与数字字符“0”区分。
const GLYPHS = { '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'] };

function randomGenerator(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed 必须为 uint32');
    let value = seed >>> 0;
    return () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

function checkConfig(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };
    for (const key of ['height', 'width', 'channels', 'hiddenSize', 'classes']) {
        if (!Number.isInteger(config[key]) || config[key] < 1) throw new RangeError(`${key} 必须为正整数`);
    }
    if (config.height < 2 || config.width < 2 || config.classes < 2) throw new RangeError('空间尺寸和类别数至少为2');
    randomGenerator(config.seed);
    return config;
}

function cnnSequenceShape(options = {}, batch = 1) {
    const c = checkConfig(options);
    if (!Number.isInteger(batch) || batch < 1) throw new RangeError('batch 必须为正整数');
    const height = Math.floor(c.height / 2), time = Math.floor(c.width / 2), features = height * c.channels;
    return { input: [batch, c.height, c.width, 1], convolution: [batch, c.height, c.width, c.channels],
        pooled: [batch, height, time, c.channels], sequence: [batch, time, features],
        bidirectional: [batch, time, 2 * c.hiddenSize], logits: [batch, time, c.classes] };
}

// 标签仅供数据生成和损失；predictRows 的参数只有像素，根本不接收真值。
function renderSyntheticLine(text, { seed = 1, height = 8, width = 20, noise = 0.08 } = {}) {
    if (typeof text !== 'string' || !/^[01]{1,3}$/.test(text)) throw new TypeError('教学数据仅支持1–3位0/1字符串');
    if (!Number.isInteger(height) || height < 7 || !Number.isInteger(width) || width < text.length * 5 + 2
        || !Number.isFinite(noise) || noise < 0 || noise > 0.4) throw new RangeError('图像尺寸或噪声不合法');
    const rng = randomGenerator(seed), pixels = new Float32Array(height * width);
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] = rng() * noise;
    }
    let x = 1 + Math.floor(rng() * 2);
    for (const char of text) {
        const y0 = 1 + Math.floor(rng() * (height - 5));
        const intensity = 0.8 + 0.2 * rng();
        for (let y = 0; y < GLYPHS[char].length; y++) {
            const row = GLYPHS[char][y];
            for (let dx = 0; dx < row.length; dx++) {
                if (row[dx] === '1') {
                    pixels[(y + y0) * width + x + dx] = intensity - rng() * noise;
                }
            }
        }
        x += 4 + Math.floor(rng() * 2);
    }
    return { pixels, height, width };
}

function createSyntheticDataset({ seed = 71, copies = 2 } = {}) {
    randomGenerator(seed);
    if (!Number.isInteger(copies) || copies < 1 || copies > 100) throw new RangeError('copies 必须为1–100');
    const strings = ['0', '1', '00', '01', '10', '11', '000', '001', '010', '011', '100', '101', '110', '111'];
    return Array.from({ length: copies }, (_, copy) => strings.map((truth, i) => ({
        id: `synthetic-${seed}-${copy}-${i}`, truth, labels: [...truth].map(x => Number(x) + 1),
        ...renderSyntheticLine(truth, { seed: (seed + copy * 1009 + i * 53) >>> 0 })
    }))).flat();
}

function createTinyCrnn(tf, options = {}) {
    const config = checkConfig(options), rng = randomGenerator(config.seed);
    const { channels: C, hiddenSize: H, classes: K } = config;
    const F = cnnSequenceShape(config).sequence[2], variables = {};
    function weight(key, shape, scale, bias) {
        const size = shape.reduce((a, b) => a * b, 1);
        const values = Array.from({ length: size }, (_, i) => bias ? bias(i) : (rng() * 2 - 1) * scale);
        // tf.variable 不由 tidy 自动释放，临时初值张量由 tidy 释放。
        variables[key] = tf.tidy(() => tf.variable(tf.tensor(values, shape)));
    }
    weight('convKernel', [3, 3, 1, C], Math.sqrt(6 / (9 + 9 * C)));
    weight('convBias', [C], 0);
    for (const direction of ['forward', 'backward']) {
        weight(`${direction}Kernel`, [F + H, 4 * H], Math.sqrt(6 / (F + H + 4 * H)));
        weight(`${direction}Bias`, [4 * H], 0, i => i >= H && i < 2 * H ? 1 : 0);
    }
    weight('outputKernel', [2 * H, K], Math.sqrt(6 / (2 * H + K)));
    weight('outputBias', [K], 0);

    function scan(sequence, direction) {
        const [B, T] = sequence.shape, frames = tf.unstack(sequence, 1), states = [];
        let h = tf.zeros([B, H]), cell = tf.zeros([B, H]);
        for (let n = 0; n < T; n++) {
            const t = direction === 'forward' ? n : T - 1 - n;
            const gates = tf.concat([frames[t], h], 1).matMul(variables[`${direction}Kernel`]).add(variables[`${direction}Bias`]);
            const [ai, af, ag, ao] = tf.split(gates, 4, 1);
            cell = tf.sigmoid(af).mul(cell).add(tf.sigmoid(ai).mul(tf.tanh(ag)));
            h = tf.sigmoid(ao).mul(tf.tanh(cell));
            states[t] = h; // 反向扫描也按原图左到右索引还原。
        }
        return tf.stack(states, 1);
    }

    function forward(images, capture = false) {
        if (images.rank !== 4 || images.shape[0] < 1 || images.shape.slice(1).join(',') !== [config.height, config.width, 1].join(',')) {
            throw new TypeError(`输入必须为 [B,${config.height},${config.width},1]`);
        }
        return tf.tidy(() => {
            const convolution = tf.tanh(tf.conv2d(images, variables.convKernel, 1, 'same').add(variables.convBias));
            const pooled = tf.avgPool(convolution, [2, 2], [2, 2], 'valid');
            const [B, hp, T] = pooled.shape;
            // NHWC -> NWHC 后才能把每列 H'C 个特征当成一个时间步。
            const sequence = pooled.transpose([0, 2, 1, 3]).reshape([B, T, hp * C]);
            const forwardStates = scan(sequence, 'forward'), backwardStates = scan(sequence, 'backward');
            const context = tf.concat([forwardStates, backwardStates], 2);
            const logits = context.reshape([B * T, 2 * H]).matMul(variables.outputKernel).add(variables.outputBias).reshape([B, T, K]);
            return capture ? { convolution, pooled, sequence, forwardStates, backwardStates, logits } : logits;
        });
    }

    function inspect(images) {
        return tf.tidy(() => Object.fromEntries(Object.entries(forward(images, true)).map(([key, tensor]) =>
            [key, { shape: tensor.shape, values: tensor.arraySync() }])));
    }

    function exportWeights() {
        return { format: 'ocr-course-tiny-crnn-v1', config: { ...config }, alphabet: ALPHABET.slice(),
            weights: Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, { shape: value.shape, values: Array.from(value.dataSync()) }])) };
    }

    function importWeights(artifact) {
        if (!artifact || artifact.format !== 'ocr-course-tiny-crnn-v1'
            || Object.keys(config).some(key => artifact.config?.[key] !== config[key])) throw new TypeError('权重格式或模型配置不匹配');
        if (!Array.isArray(artifact.alphabet) || artifact.alphabet.length !== ALPHABET.length
            || ALPHABET.some((label, k) => artifact.alphabet[k] !== label)) {
            throw new TypeError('权重字符映射必须为 [blank, 数字0, 数字1]，顺序不能交换');
        }
        // 先验证全部权重，避免部分导入后才报错。
        for (const [key, value] of Object.entries(variables)) {
            const saved = artifact.weights?.[key];
            if (!saved || !Array.isArray(saved.shape) || saved.shape.join(',') !== value.shape.join(',')
                || !Array.isArray(saved.values) || saved.values.length !== value.size
                || Array.from(saved.values).some(x => !Number.isFinite(x) || !Number.isFinite(Math.fround(x)))) {
                throw new TypeError(`权重 ${key} 不合法`);
            }
        }
        tf.tidy(() => {
            for (const [key, value] of Object.entries(variables)) {
                value.assign(tf.tensor(artifact.weights[key].values, value.shape));
            }
        });
    }

    return { config, variables, forward, inspect, exportWeights, importWeights,
        parameterCount: Object.values(variables).reduce((sum, v) => sum + v.size, 0),
        dispose: () => Object.values(variables).forEach(v => v.dispose()) };
}

function imageBatch(tf, images, config) {
    if (!Array.isArray(images) || !images.length) throw new TypeError('图像批次不能为空');
    const values = new Float32Array(images.length * config.height * config.width);
    images.forEach((image, i) => {
        if (!image || image.height !== config.height || image.width !== config.width || !image.pixels
            || image.pixels.length !== config.height * config.width
            || Array.from(image.pixels).some(x => !Number.isFinite(x) || x < 0 || x > 1)) throw new TypeError('像素必须为匹配尺寸的 [0,1] 前景强度');
        values.set(image.pixels, i * config.height * config.width);
    });
    return tf.tensor4d(values, [images.length, config.height, config.width, 1]);
}

function predictRows(tf, model, images, beamWidth = 10) {
    if (model.config.classes !== ALPHABET.length) throw new RangeError('文本解码器仅支持 blank/0/1 的3类模型');
    const batch = imageBatch(tf, images, model.config);
    try {
        const probabilities = tf.tidy(() => tf.softmax(model.forward(batch), -1).arraySync());
        return probabilities.map(rows => {
            const greedy = greedyDecode(rows), beam = prefixBeamDecode(rows, 0, beamWidth);
            return { prediction: beam[0].labels.map(x => ALPHABET[x]).join(''),
                greedy: greedy.labels.map(x => ALPHABET[x]).join(''), path: greedy.path,
                probability: beam[0].probability, probabilities: rows };
        });
    } finally { batch.dispose(); }
}

function evaluateRows(tf, model, records) {
    // inference 的边界只传图像；truth 在返回预测后才进入指标计算。
    const predictions = predictRows(tf, model, records.map(({ pixels, width, height }) => ({ pixels, width, height })));
    const rows = predictions.map((result, i) => ({ id: records[i].id, truth: records[i].truth,
        prediction: result.prediction, greedy: result.greedy, correct: records[i].truth === result.prediction }));
    return { count: rows.length, exactCorrect: rows.filter(x => x.correct).length,
        exactAccuracy: rows.filter(x => x.correct).length / rows.length, rows };
}

function gradientCheck(tf) {
    const values = [[[0.2, -0.4, 0.1], [-0.2, 0.3, 0.4], [0.5, 0.2, -0.3]]];
    const target = [[1, 1]], input = tf.tensor3d(values), analytic = tf.grad(x => differentiableCtcLoss(tf, x, target))(input);
    const actual = Array.from(analytic.dataSync()), epsilon = 1e-4;
    const expected = [];
    for (let t = 0; t < 3; t++) {
        for (let k = 0; k < 3; k++) {
            const plus = values[0].map(row => row.slice());
            const minus = values[0].map(row => row.slice());
            plus[t][k] += epsilon;
            minus[t][k] -= epsilon;
            const plusLoss = ctcLossAndGradient(plus, target[0]).loss;
            const minusLoss = ctcLossAndGradient(minus, target[0]).loss;
            expected.push((plusLoss - minusLoss) / (2 * epsilon));
        }
    }
    input.dispose(); analytic.dispose();
    return { maxAbsoluteError: Math.max(...actual.map((v, i) => Math.abs(v - expected[i]))), coordinates: actual.length, epsilon };
}

async function trainTinyCrnn(tf, { steps = 160, learningRate = 0.02, seed = DEFAULT_CONFIG.seed, onProgress = () => {} } = {}) {
    if (!Number.isInteger(steps) || steps < 1 || steps > 5000 || !Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 1) {
        throw new RangeError('steps 必须为1–5000；learningRate 必须在(0,1]');
    }
    const model = createTinyCrnn(tf, { seed }), train = createSyntheticDataset({ seed: 71, copies: 2 });
    const validation = createSyntheticDataset({ seed: 19001, copies: 1 });
    const xs = imageBatch(tf, train, model.config), targets = train.map(x => x.labels), optimizer = tf.train.adam(learningRate);
    const variableList = Object.values(model.variables), history = [], firstGradientNorms = {};
    const initialConv = Array.from(model.variables.convKernel.dataSync());
    const objective = () => differentiableCtcLoss(tf, model.forward(xs), targets);
    const lossValue = () => tf.tidy(() => objective().dataSync()[0]);
    const started = Date.now(), initialLoss = lossValue();
    const initialValidation = evaluateRows(tf, model, validation);
    try {
        for (let step = 1; step <= steps; step++) {
            tf.tidy(() => {
                const { value, grads } = tf.variableGrads(objective, variableList);
                if (!Number.isFinite(value.dataSync()[0])) throw new Error('训练损失不是有限数值');
                if (step === 1) {
                    for (const [key, variable] of Object.entries(model.variables)) {
                        const gradient = grads[variable.name];
                        if (!gradient || Array.from(gradient.dataSync()).some(v => !Number.isFinite(v))) {
                            throw new Error(`${key} 缺失有效梯度`);
                        }
                        firstGradientNorms[key] = gradient.square().sum().sqrt().dataSync()[0];
                    }
                }
                // 小模型也保留全局范数裁剪，缓解循环网络的梯度爆炸。
                const norm = tf.addN(Object.values(grads).map(g => g.square().sum())).sqrt();
                const factor = tf.minimum(tf.scalar(1), tf.scalar(5).div(norm.add(1e-8)));
                optimizer.applyGradients(Object.fromEntries(Object.entries(grads).map(([name, g]) => [name, g.mul(factor)])));
            });
            if (step === 1 || step % 20 === 0 || step === steps) {
                const item = { step, loss: lossValue(), elapsedMs: Date.now() - started }; history.push(item);
                await onProgress(item);
            }
            if (step % 5 === 0) await tf.nextFrame();
        }
        const convChange = Math.max(...Array.from(model.variables.convKernel.dataSync()).map((v, i) => Math.abs(v - initialConv[i])));
        const report = { experiment: '真实端到端 CNN + BiLSTM + CTC；小型合成0/1数字串',
            tfjs: tf.version.tfjs, backend: tf.getBackend(), config: model.config, parameterCount: model.parameterCount,
            steps, learningRate, clippingGlobalNorm: 5, initialLoss, finalLoss: lossValue(), history,
            firstGradientNorms, maxConvolutionWeightChange: convChange, ctcGradientCheck: gradientCheck(tf),
            initialValidation, train: evaluateRows(tf, model, train), validation: evaluateRows(tf, model, validation),
            data: { trainSeed: 71, validationSeed: 19001, trainCopies: 2, validationCopies: 1,
                scope: '同一字形生成器、相同14种字符串、新噪声和位移；用于教学验证，不是独立手写测试集' },
            elapsedMs: Date.now() - started };
        return { model, report };
    } catch (error) { model.dispose(); throw error; }
    finally { xs.dispose(); optimizer.dispose(); }
}

module.exports = { DEFAULT_CONFIG, ALPHABET, randomGenerator, cnnSequenceShape, renderSyntheticLine,
    createSyntheticDataset, createTinyCrnn, imageBatch, predictRows, evaluateRows, gradientCheck, trainTinyCrnn };
