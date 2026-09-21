// 本模块是浏览器与 Node 的共同数学规则；图形只读取这里的结果。
export const models = Object.freeze({
  square: { label: 'f(x) = x²', value: x => x * x, derivative: a => 2 * a },
  linear: { label: 'f(x) = 2x + 1', value: x => 2 * x + 1, derivative: () => 2 },
  absolute: { label: 'f(x) = |x|', value: x => Math.abs(x), derivative: a => a === 0 ? null : Math.sign(a) },
});
export const defaults = Object.freeze({ kind: 'square', a: 2, h: 0.5 });

export function validate(kind, a, h) {
  if (!Object.hasOwn(models, kind)) throw new Error('请选择平方、直线或绝对值函数。');
  if (!Number.isFinite(a) || !Number.isFinite(h)) throw new Error('观察点和增量都需要填写有限数字。');
  if (Math.abs(a) > 3) throw new Error('本实验的观察点 a 应在 −3 到 3 之间。');
  if (h === 0) throw new Error('差商不能除以 0。请填写非零增量；趋近 0 不等于取到 0。');
  if (Math.abs(h) < 0.000001 || Math.abs(h) > 2) throw new Error('本实验要求 0.000001 ≤ |h| ≤ 2；这是显示范围，不是极限的定义。');
}

export function sample(kind, a, h) {
  validate(kind, a, h);
  const model = models[kind];
  const b = a + h;
  const valueA = model.value(a), valueB = model.value(b);
  const delta = valueB - valueA;
  const rawQuotient = delta / h;
  // (a+h)²−a² = h(2a+h)：化简后少做一次接近数相减。
  // 直线 2x+1 的变化量是 2h；绝对值则直接按两端值计算。
  const quotient = kind === 'square' ? 2 * a + h : kind === 'linear' ? 2 : rawQuotient;
  const derivative = model.derivative(a);
  const predictedDelta = derivative === null ? null : derivative * h;
  return {
    kind, a, h, b, valueA, valueB, delta, rawQuotient, quotient, derivative, predictedDelta,
    approximationError: predictedDelta === null ? null : delta - predictedDelta,
  };
}

export function twoSided(kind, a, h) {
  // 数表下限与输入一致；到达最小步长时去掉重复行。
  const sizes = [...new Set([1, 0.1, 0.01].map(scale => Math.max(0.000001, Math.abs(h) * scale)))];
  return sizes.map(size => ({ size, left: sample(kind, a, -size), right: sample(kind, a, size) }));
}

export function format(value) {
  if (value === null) return '不存在';
  if (value === 0) return '0';
  return String(Number(value.toPrecision(9)));
}

export function algebra(kind, a) {
  if (kind === 'square') return `对 h ≠ 0，差商 = 2a + h = ${format(2 * a)} + h。两侧趋近给出导数 ${format(2 * a)}。`;
  if (kind === 'linear') return '对 h ≠ 0，差商 = 2h / h = 2；直线的割线与切线重合。';
  if (a === 0) return 'a = 0 时，差商 = |h| / h。左侧恒为 −1，右侧恒为 1；该点导数不存在。';
  return `a = ${format(a)} 附近，只要 |h| < |a|，第二点不越过尖点，差商恒为 ${Math.sign(a)}。该点导数为 ${Math.sign(a)}。`;
}
