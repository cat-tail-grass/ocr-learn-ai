import assert from 'node:assert/strict';
import { models, sample, twoSided, defaults, format, algebra } from '../shared/rate-model.js';

function printSample(kind, a, h) {
  const r = sample(kind, a, h);
  console.log(`\n输入：${models[kind].label}，a = ${a}，h = ${h}（非零）`);
  console.log(`① 两个输入：${format(a)} → ${format(r.b)}`);
  console.log(`② 两个输出：${format(r.valueA)} → ${format(r.valueB)}`);
  console.log(`③ 输出变化量：${format(r.valueB)} − ${format(r.valueA)} = ${format(r.delta)}`);
  console.log(`④ 原始差商：${format(r.delta)} / ${h} = ${format(r.rawQuotient)}`);
  console.log(`⑤ 按代数规则计算的差商：${format(r.quotient)}；该点导数：${format(r.derivative)}`);
  console.log(algebra(kind, a));
  if (r.derivative !== null) console.log(`切线预测变化量：${format(r.predictedDelta)}；真实变化减预测：${format(r.approximationError)}`);
  return r;
}

function manualChecks() {
  let count = 0;
  const close = (actual, expected, note) => { assert.ok(Math.abs(actual - expected) < 1e-10, `${note}: ${actual} ≠ ${expected}`); count++; };
  // 这些预期值独立来自讲义里的代入与手算，不使用导数函数生成。
  const r = sample('square', 2, 0.5);
  for (const [key, value] of Object.entries({ b: 2.5, valueA: 4, valueB: 6.25, delta: 2.25, quotient: 4.5, derivative: 4, predictedDelta: 2, approximationError: 0.25 })) close(r[key], value, key);
  for (const [a, h, q, d] of [[2,-0.2,3.8,4],[1,0.5,2.5,2],[-1,0.1,-1.9,-2],[-1,-0.1,-2.1,-2]]) {
    const s = sample('square', a, h); close(s.quotient, q, '迁移差商'); close(s.derivative, d, '迁移导数');
  }
  for (const h of [-0.5, 0.5]) close(sample('linear', 1, h).quotient, 2, '直线差商');
  close(sample('absolute', 0, -0.01).quotient, -1, '尖点左侧');
  close(sample('absolute', 0, 0.01).quotient, 1, '尖点右侧');
  assert.equal(sample('absolute', 0, 0.01).derivative, null); count++;
  assert.throws(() => sample('square', 2, 0), /不能除以 0/); count++;
  assert.throws(() => sample('square', NaN, 0.1), /有限数字/); count++;
  assert.throws(() => sample('square', 4, 0.1), /−3 到 3/); count++;
  assert.throws(() => sample('square', 2, 3), /显示范围/); count++;
  console.log(`\n${count} 项独立手算值与边界断言通过。它们验证列出的计算与拒绝规则，不证明全部数学命题。`);
}

try {
  const args = process.argv.slice(2);
  if (args.length) {
    const options = { ...defaults };
    const used = new Set();
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i], value = args[i + 1];
      if (!['--function', '--a', '--h'].includes(key) || value === undefined || used.has(key) || value.trim() === '') throw new Error('用法：node 03-derivative-at-a-point/index.js --function square|linear|absolute --a 2 --h 0.5');
      used.add(key);
      if (key === '--function') options.kind = value;
      else options[key.slice(2)] = Number(value);
    }
    printSample(options.kind, options.a, options.h);
  } else {
    printSample(defaults.kind, defaults.a, defaults.h);
    console.log('\n同一观察点 a=2 的两侧差商（不能只取一侧）：');
    for (const row of twoSided('square', 2, 0.5)) console.log(`|h|=${format(row.size)}：左 ${format(row.left.quotient)}；右 ${format(row.right.quotient)}`);
    printSample('linear', 2, 0.5);
    printSample('absolute', 0, -0.1);
    printSample('absolute', 0, 0.1);
    try { sample('square', 2, 0); } catch (error) { console.log(`\n零增量边界：${error.message}`); }
    manualChecks();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
