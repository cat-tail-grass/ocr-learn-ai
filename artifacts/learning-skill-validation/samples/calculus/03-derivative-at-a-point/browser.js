import { models, defaults, sample, twoSided, format, algebra } from '../shared/rate-model.js';

const $ = id => document.getElementById(id);
const select = $('function'), point = $('point'), increment = $('increment'), status = $('status');
const NS = 'http://www.w3.org/2000/svg';

function node(tag, attributes = {}, text = '') {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  if (text) el.textContent = text;
  return el;
}

function graph(r) {
  const svg = $('graph');
  [...svg.children].forEach(el => { if (!['title', 'desc'].includes(el.tagName)) el.remove(); });
  const fn = models[r.kind].value;
  const xMin = Math.min(-1, r.a - 1.2, r.b - 0.6), xMax = Math.max(3, r.a + 1.2, r.b + 0.6);
  const points = Array.from({ length: 201 }, (_, i) => xMin + (xMax - xMin) * i / 200);
  const sec = x => r.valueA + r.quotient * (x - r.a);
  const tan = x => r.valueA + (r.derivative ?? 0) * (x - r.a);
  const allY = points.map(fn).concat([0, sec(xMin), sec(xMax)], r.derivative === null ? [] : [tan(xMin), tan(xMax)]);
  const span = Math.max(1, Math.max(...allY) - Math.min(...allY));
  const yMin = Math.min(...allY) - span * 0.1, yMax = Math.max(...allY) + span * 0.1;
  const X = x => 66 + (x - xMin) / (xMax - xMin) * 622;
  const Y = y => 372 - (y - yMin) / (yMax - yMin) * 336;
  const line = (x1, y1, x2, y2, color, width = 1, dash = '') => svg.append(node('line', { x1: X(x1), y1: Y(y1), x2: X(x2), y2: Y(y2), stroke: color, 'stroke-width': width, ...(dash ? { 'stroke-dasharray': dash } : {}) }));
  for (let i = 0; i <= 4; i++) {
    const x = xMin + (xMax - xMin) * i / 4, y = yMin + (yMax - yMin) * i / 4;
    line(x, yMin, x, yMax, '#e1e8e3'); line(xMin, y, xMax, y, '#e1e8e3');
    svg.append(node('text', { x: X(x), y: 399, 'text-anchor': 'middle', fill: '#5d7078', 'font-size': 13 }, Number(x.toFixed(2)).toString()));
    svg.append(node('text', { x: 55, y: Y(y) + 4, 'text-anchor': 'end', fill: '#5d7078', 'font-size': 13 }, Number(y.toFixed(1)).toString()));
  }
  line(xMin, 0, xMax, 0, '#9eafa5');
  if (xMin <= 0 && xMax >= 0) line(0, yMin, 0, yMax, '#9eafa5');
  svg.append(node('text', { x: 682, y: 421, fill: '#344c40', 'font-size': 14 }, 'x'));
  svg.append(node('text', { x: 14, y: 21, fill: '#344c40', 'font-size': 14 }, 'f(x)'));
  const path = points.map((x, i) => `${i ? 'L' : 'M'}${X(x)},${Y(fn(x))}`).join(' ');
  svg.append(node('path', { d: path, fill: 'none', stroke: '#254d70', 'stroke-width': 3 }));
  line(xMin, sec(xMin), xMax, sec(xMax), '#b86216', 2.5);
  if (r.derivative !== null && $('show-tangent').checked) {
    const tangent = node('line', { id: 'tangent-line', x1: X(xMin), y1: Y(tan(xMin)), x2: X(xMax), y2: Y(tan(xMax)), stroke: '#126451', 'stroke-width': 3, 'stroke-dasharray': '9 5' });
    svg.append(tangent);
  }
  for (const [x, y, color, label, offset] of [[r.a, r.valueA, '#126451', 'A', -15], [r.b, r.valueB, '#b86216', 'B', 21]]) {
    svg.append(node('circle', { cx: X(x), cy: Y(y), r: 6, fill: color, stroke: 'white', 'stroke-width': 2 }));
    svg.append(node('text', { x: X(x) + 10, y: Y(y) + offset, fill: color, 'font-size': 16, 'font-weight': 700 }, label));
  }
  $('graph-description').textContent = `函数 ${models[r.kind].label}；A=(${format(r.a)},${format(r.valueA)})；B=(${format(r.b)},${format(r.valueB)})。割线斜率 ${format(r.quotient)}；该点导数 ${format(r.derivative)}。`;
}

function values() {
  return { kind: select.value, a: point.value.trim() === '' ? NaN : Number(point.value), h: increment.value.trim() === '' ? NaN : Number(increment.value) };
}

function render() {
  try {
    const { kind, a, h } = values();
    const r = sample(kind, a, h);
    $('results').hidden = false; $('comparison-table').hidden = false;
    status.classList.remove('error');
    status.textContent = `已更新：${h > 0 ? '右侧' : '左侧'}增量 h=${format(h)}，第二点 x=${format(r.b)}。`;
    $('quotient').textContent = format(r.quotient);
    $('derivative').textContent = r.derivative === null ? '该点导数不存在' : format(r.derivative);
    $('steps').replaceChildren();
    for (const text of [
      `输入：a = ${format(a)}，a + h = ${format(r.b)}。`,
      `输出：f(a) = ${format(r.valueA)}，f(a+h) = ${format(r.valueB)}。`,
      `输出变化量：${format(r.valueB)} − ${format(r.valueA)} = ${format(r.delta)}。`,
      `差商：${format(r.delta)} ÷ ${format(h)} = ${format(r.rawQuotient)}（直接相减计算）。`,
    ]) { const li = document.createElement('li'); li.textContent = text; $('steps').append(li); }
    $('algebra').textContent = algebra(kind, a);
    $('approximation').textContent = r.derivative === null
      ? '两侧没有共同的有限导数，图中不画唯一切线，也不使用导数预测变化量。'
      : `用导数预测变化量：${format(r.derivative)} × ${format(h)} = ${format(r.predictedDelta)}。真实变化减预测：${format(r.approximationError)}。把预测与真实变化对照，判断本次误差。`;
    $('comparison').replaceChildren();
    for (const row of twoSided(kind, a, h)) {
      const tr = document.createElement('tr');
      for (const value of [row.size, row.left.quotient, row.right.quotient]) { const td = document.createElement('td'); td.textContent = format(value); tr.append(td); }
      $('comparison').append(tr);
    }
    $('comparison-note').textContent = kind === 'absolute' && a === 0
      ? '每一行左侧都是 −1，右侧都是 1。再缩小也不会得到共同极限。'
      : '数表提供有限样本的观察；导数结论由上方的代数关系与趋近条件支持。';
    graph(r);
  } catch (error) {
    status.classList.add('error'); status.textContent = error.message;
    $('results').hidden = true; $('comparison-table').hidden = true;
    $('comparison-note').textContent = '请先修正输入或恢复初始示例；旧结果已隐藏。';
  }
}

function reset() {
  select.value = defaults.kind; point.value = defaults.a; increment.value = defaults.h; $('show-tangent').checked = true;
  render();
}
for (const control of [select, point, increment, $('show-tangent')]) control.addEventListener('input', render);
$('reset').addEventListener('click', reset);
$('reverse').addEventListener('click', () => { const { h } = values(); if (Number.isFinite(h)) increment.value = -h; render(); });
$('shrink').addEventListener('click', () => {
  const { h } = values();
  if (Number.isFinite(h) && h !== 0) increment.value = Math.sign(h) * Math.max(0.000001, Math.abs(h) / 10);
  render();
  if (Math.abs(Number(increment.value)) === 0.000001) status.textContent += ' 已到实验最小步长；数学上仍可继续趋近。';
});
$('corner').addEventListener('click', () => { select.value = 'absolute'; point.value = 0; increment.value = 0.5; render(); });
render();
