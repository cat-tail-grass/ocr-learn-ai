'use strict';

const tf = require('@tensorflow/tfjs');
const {
  createDigitModel
} = require('../shared/17-cnn-classifier');
const {
  captureModel
} = require('../shared/16-tensorflowjs-intro');
function bindWebGLTraining() {
  const button = document.getElementById('train'),
    output = document.getElementById('training-log');
  const bridgeInput = document.getElementById('bridge-url');
  const bridgeStatus = document.getElementById('bridge-status');
  const checkButton = document.getElementById('check-bridge');
  const queryBridge = new URL(location.href).searchParams.get('bridge');
  if (queryBridge) bridgeInput.value = queryBridge;
  document.getElementById('bridge-origin').textContent = `当前页面来源：${location.origin}；数据桥需要明确允许此来源。`;
  function bridgeUrl() {
    const url = new URL(bridgeInput.value);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('数据桥地址必须是本机 HTTP 来源，例如 http://127.0.0.1:4174');
    }
    return url.origin;
  }
  const log = value => {
    output.textContent += `${typeof value === 'string' ? value : JSON.stringify(value)}\n`;
  };
  async function request(route, body) {
    const response = await fetch(`${bridgeUrl()}${route}`, body ? {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    } : {});
    if (!response.ok) throw new Error(await response.text());
    return response;
  }
  checkButton.addEventListener('click', async () => {
    checkButton.disabled = true;
    bridgeStatus.textContent = '正在读取数据桥配置…';
    try {
      const response = await request('/config');
      const config = await response.json();
      bridgeStatus.textContent = JSON.stringify({
        connected: true,
        bridge: bridgeUrl(),
        pageOrigin: location.origin,
        mode: response.headers.get('X-OCR-Bridge-Mode') || 'training',
        config,
        note: '仅检查连接并读取配置，没有启动训练或保存模型。'
      }, null, 2);
    } catch (error) {
      bridgeStatus.textContent = `连接失败：${error.message}。请检查数据桥已启动、端口一致，且 OCR_TRAIN_ORIGINS 包含 ${location.origin}。`;
    } finally { checkButton.disabled = false; }
  });
  async function tensors(route, count) {
    const buffer = await (await request(route)).arrayBuffer();
    if (buffer.byteLength !== count * (784 + 10) * 4) throw new Error('数据桥返回尺寸不符');
    return [tf.tensor4d(new Float32Array(buffer, 0, count * 784), [count, 28, 28, 1]), tf.tensor2d(new Float32Array(buffer, count * 784 * 4, count * 10), [count, 10])];
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    bridgeInput.disabled = true;
    checkButton.disabled = true;
    let model, optimizer, validation;
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      const baseline = tf.memory().numTensors,
        start = performance.now(),
        configResponse = await request('/config');
      if (configResponse.headers.get('X-OCR-Bridge-Mode') === 'config-only') {
        throw new Error('数据桥当前是只读配置模式；请重启数据桥并指定新的模型输出目录后再训练');
      }
      const config = await configResponse.json();
      const environment = {
        tfjs: tf.version.tfjs,
        backend: tf.getBackend(),
        userAgent: navigator.userAgent
      };
      log({
        event: 'start',
        environment,
        config
      });
      model = createDigitModel(tf, config);
      optimizer = tf.train.adam(config.learningRate);
      model.compile({
        optimizer,
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
      validation = await tensors('/validation', config.validationSize);
      for (let epoch = 0; epoch < config.epochs; epoch++) {
        const epochStart = performance.now(),
          [x, y] = await tensors(`/epoch/${epoch}`, config.trainSize);
        log({
          event: 'epoch-start',
          epoch: epoch + 1
        });
        try {
          const history = await model.fit(x, y, {
            epochs: 1,
            batchSize: config.batchSize,
            validationData: validation,
            shuffle: false,
            verbose: 0,
            callbacks: {
              onBatchEnd: async (batch, logs) => {
                if (batch % 100 === 0) {
                  log({
                    epoch: epoch + 1,
                    batch,
                    loss: logs.loss
                  });
                  await tf.nextFrame();
                }
              }
            }
          });
          const row = {
            epoch: epoch + 1,
            loss: history.history.loss[0],
            accuracy: history.history.acc[0],
            validationLoss: history.history.val_loss[0],
            validationAccuracy: history.history.val_acc[0],
            seconds: (performance.now() - epochStart) / 1000
          };
          log({
            event: 'epoch-end',
            ...row
          });
          const artifacts = await captureModel(tf, model);
          const checkpoint = await (await request('/checkpoint', {
            row,
            environment,
            artifacts: {
              modelTopology: artifacts.modelTopology,
              weightSpecs: artifacts.weightSpecs,
              weightData: Array.from(new Uint8Array(artifacts.weightData))
            }
          })).json();
          log(checkpoint);
        } finally {
          x.dispose();
          y.dispose();
        }
      }
      const trainingSeconds = (performance.now() - start) / 1000;
      model.dispose();
      optimizer.dispose();
      validation.forEach(t => t.dispose());
      model = optimizer = validation = null;
      const tensorCheck = {
        baseline,
        afterDispose: tf.memory().numTensors
      };
      log({
        event: 'training-complete',
        trainingSeconds,
        tensorCheck
      });
      log('配置已冻结；等待 Node 重新加载模型，并完成全部 10,000 个测试样本的评估。');
      log(await (await request('/complete', {
        trainingSeconds,
        tensorCheck
      })).json());
      log('完成：权重、训练报告与逐样本测试预测已保存。');
    } catch (error) {
      log(`失败：${error.message}`);
    } finally {
      if (model) model.dispose();
      if (optimizer) optimizer.dispose();
      if (validation) validation.forEach(t => t.dispose());
      button.disabled = false;
      bridgeInput.disabled = false;
      checkButton.disabled = false;
    }
  });
}
module.exports = {
  bindWebGLTraining
};
