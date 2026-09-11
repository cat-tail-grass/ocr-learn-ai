'use strict';

// 仅监听回环地址的数据/模型桥。网页由统一站点提供，算法来自 shared。
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const tf = require('@tensorflow/tfjs');
const {
  PREPROCESSING,
  shuffledIndices
} = require('../shared/17-cnn-classifier');
const {
  downloadMNIST,
  loadMNIST,
  makeSplit,
  prepareSamples
} = require('./data');
const {
  saveModel,
  loadModel
} = require('./model-io');
const {
  evaluate
} = require('./train');
function bridgeSettings(env = process.env) {
  const port = Number(env.OCR_TRAIN_PORT || 4174);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('OCR_TRAIN_PORT 必须是 1–65535 的整数');
  const pageHost = env.SITE_HOST || '127.0.0.1';
  const defaultOrigin = `http://${pageHost.includes(':') && !pageHost.startsWith('[') ? `[${pageHost}]` : pageHost}:${env.SITE_PORT || 4173}`;
  const origins = (env.OCR_TRAIN_ORIGINS || defaultOrigin).split(',').map(value => {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/' || url.username || url.password || url.search || url.hash) {
      throw new Error(`OCR_TRAIN_ORIGINS 仅接受精确的本机来源，不含站点路径：${value}`);
    }
    return url.origin;
  });
  const rawBase = env.SITE_BASE || '/';
  if (!rawBase.startsWith('/') || /[?#\\]|\.{2}/.test(rawBase)) throw new Error('SITE_BASE 必须是 / 或 /ocr/ 等站点路径');
  const base = '/' + rawBase.split('/').filter(Boolean).join('/') + (rawBase.split('/').filter(Boolean).length ? '/' : '');
  return { port, origins: [...new Set(origins)], base };
}
async function main(args = process.argv.slice(2), env = process.env) {
  const settings = bridgeSettings(env);
  const configOnly = args.includes('--config-only');
  if (args.some(arg => arg.startsWith('--') && arg !== '--config-only')) throw new Error('未知数据桥选项');
  const directory = path.resolve(args.find(arg => !arg.startsWith('--')) || path.join(__dirname, 'model-webgl'));
  if (!configOnly) {
    try {
      await fs.access(path.join(directory, 'model.json'));
      throw new Error('已有模型；请指定新的输出目录');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await tf.setBackend('cpu');
    await tf.ready();
  }
  const config = {
    seed: 1701,
    trainSize: 55000,
    validationSize: 5000,
    epochs: 5,
    batchSize: 128,
    learningRate: 0.001,
    dropoutSeedPolicy: 'resample',
    augmentation: {
      probability: 0.5,
      rotationDegrees: [-8, 8],
      stretchX: [0.9, 1.1],
      regeneratedEachEpoch: true
    }
  };
  let sources, dataset, split;
  if (!configOnly) {
    sources = await downloadMNIST();
    dataset = await loadMNIST('train');
    split = makeSplit(dataset.count, config);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'split.json'), JSON.stringify(split));
  }
  const curves = [],
    started = Date.now();
  let bestLoss = Infinity,
    bestEpoch,
    saved,
    environment,
    completed = false;
  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && !settings.origins.includes(origin)) {
      response.writeHead(403);
      response.end('Origin denied');
      return;
    }
    response.setHeader('Access-Control-Allow-Origin', origin || settings.origins[0]);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', configOnly ? 'GET, OPTIONS' : 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Expose-Headers', 'X-OCR-Bridge-Mode');
    response.setHeader('X-OCR-Bridge-Mode', configOnly ? 'config-only' : 'training');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    try {
      const url = new URL(request.url, `http://127.0.0.1:${settings.port}`);
      if (request.method === 'GET' && url.pathname === '/config') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(config));
        return;
      }
      if (configOnly) {
        response.writeHead(405);
        response.end('当前为 --config-only，只提供 GET /config；没有启动训练或写入模型');
        return;
      }
      if (request.method === 'GET' && (url.pathname === '/validation' || /^\/epoch\/[0-4]$/.test(url.pathname))) {
        const isValidation = url.pathname === '/validation',
          epoch = isValidation ? 0 : Number(url.pathname.split('/')[2]);
        const ids = isValidation ? split.validation : shuffledIndices(split.training.length, config.seed + epoch).map(i => split.training[i]);
        const data = prepareSamples(dataset, ids, {
          augment: !isValidation,
          seed: config.seed + 1000 + epoch
        });
        response.setHeader('Content-Type', 'application/octet-stream');
        response.write(Buffer.from(data.pixels.buffer));
        response.end(Buffer.from(data.labels.buffer));
        return;
      }
      if (request.method !== 'POST' || !['/checkpoint', '/complete'].includes(url.pathname) || completed) {
        response.writeHead(404);
        response.end();
        return;
      }
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 2000000) throw new Error('payload too large');
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (url.pathname === '/checkpoint') {
        const row = body.row;
        if (!row || row.epoch !== curves.length + 1 || !Number.isFinite(row.validationLoss)) throw new Error('epoch sequence invalid');
        environment = {
          nodeBridge: process.version,
          platform: process.platform,
          arch: process.arch,
          cpu: os.cpus()[0].model,
          ...body.environment
        };
        curves.push(row);
        if (row.validationLoss < bestLoss) {
          bestLoss = row.validationLoss;
          bestEpoch = row.epoch;
          const weightData = Uint8Array.from(body.artifacts.weightData).buffer;
          const model = await tf.loadLayersModel(tf.io.fromMemory({
            ...body.artifacts,
            weightData
          }));
          try {
            saved = await saveModel(tf, model, directory, {
              preprocessing: PREPROCESSING,
              labels: Array.from({
                length: 10
              }, (_, i) => String(i)),
              seed: config.seed,
              selectedEpoch: bestEpoch,
              dataset: 'MNIST',
              inputShape: [null, 28, 28, 1],
              trainedBy: '17-cnn-classifier/webgl-training.js',
              dropoutSeedPolicy: config.dropoutSeedPolicy
            });
          } finally {
            model.dispose();
          }
        }
        await fs.writeFile(path.join(directory, 'training-curve.json'), JSON.stringify(curves, null, 2));
        await fs.writeFile(path.join(directory, 'config.json'), JSON.stringify({
          config,
          environment,
          preprocessing: PREPROCESSING,
          sources
        }, null, 2));
        console.log(JSON.stringify({
          event: 'epoch-end',
          ...row,
          ...saved
        }));
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({
          bestEpoch,
          ...saved
        }));
        return;
      }
      if (curves.length !== config.epochs) throw new Error('training incomplete');
      completed = true;
      console.log('模型已冻结，开始 CPU 独立验证及一次完整测试');
      const {
        model
      } = await loadModel(tf, directory);
      const validation = await evaluate(tf, model, dataset, split.validation);
      const testData = await loadMNIST('t10k'),
        test = await evaluate(tf, model, testData, Array.from({
          length: testData.count
        }, (_, i) => i));
      await fs.writeFile(path.join(directory, 'test-predictions.json'), JSON.stringify({
        dataset: 'MNIST t10k',
        indexConvention: 'zero-based original test index',
        truth: Array.from(testData.labels),
        predictions: test.predictions
      }));
      delete test.predictions;
      delete validation.predictions;
      const report = {
        ...saved,
        createdAt: new Date().toISOString(),
        config,
        environment,
        preprocessing: PREPROCESSING,
        sources,
        parameters: model.countParams(),
        bestEpoch,
        selection: 'minimum validation crossEntropy; test decoded only after epoch 5',
        trainingCurve: curves,
        validation,
        test,
        elapsedSeconds: (Date.now() - started) / 1000,
        browserTrainingSeconds: body.trainingSeconds,
        browserTensorCheck: body.tensorCheck,
        photoEvaluation: {
          count: 0,
          accuracy: null,
          reason: '未提供独立真实照片；MNIST 成绩不能代表照片数字串准确率'
        }
      };
      model.dispose();
      await fs.writeFile(path.join(directory, 'training-report.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({
        event: 'complete',
        modelId: saved.modelId,
        testAccuracy: test.accuracy,
        count: test.count,
        elapsedSeconds: report.elapsedSeconds,
        browserTrainingSeconds: body.trainingSeconds,
        tensorsAfterDispose: tf.memory().numTensors
      }));
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({
        modelId: saved.modelId,
        testAccuracy: test.accuracy,
        testCount: test.count
      }));
    } catch (error) {
      console.error(error);
      response.writeHead(500);
      response.end(error.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(settings.port, '127.0.0.1', resolve);
  });
  console.log(`WebGL 数据桥已就绪：http://127.0.0.1:${settings.port}（${configOnly ? '只读配置' : '训练模式'}）`);
  const bridgeQuery = settings.port === 4174 ? '' : `?${new URLSearchParams({ bridge: `http://127.0.0.1:${settings.port}` })}`;
  console.log(`明确允许来源：${settings.origins.join(', ')}；打开 ${settings.origins[0]}${settings.base}labs/17-cnn-classifier/train.html${bridgeQuery}`);
  return server;
}
module.exports = { bridgeSettings, main };
if (require.main === module) main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
