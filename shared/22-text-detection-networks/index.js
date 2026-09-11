"use strict";

function finite(x, name) {
  if (!Number.isFinite(x)) throw new TypeError(`${name} must be finite`);
  return x;
}
function probability(x, name) {
  finite(x, name);
  if (x < 0 || x > 1) throw new RangeError(`${name} must lie in [0, 1]`);
  return x;
}
function shape(map, name = "map") {
  if (
    !Array.isArray(map) ||
    !map.length ||
    !Array.isArray(map[0]) ||
    !map[0].length
  )
    throw new TypeError(`${name} must be nonempty number[][]`);
  const width = map[0].length;
  // for-of也读取数组空洞，缺失概率不能被当成前景或跳过校验。
  for (const row of map) {
    if (!Array.isArray(row) || row.length !== width)
      throw new TypeError(`${name} must be rectangular`);
    for (const x of row) probability(x, name);
  }
  return { width, height: map.length };
}
function sharpness(k) {
  finite(k, "k");
  if (k <= 0) throw new RangeError("k must be positive");
}
function sigmoid(x) {
  return x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));
}

// The actual DB operation on P/T maps; maps here need not come from a trained network.
function differentiableBinarize(P, T, k = 50) {
  const { width, height } = shape(P, "P");
  const ts = shape(T, "T");
  if (ts.width !== width || ts.height !== height)
    throw new RangeError("P/T shapes differ");
  sharpness(k);
  const binary = P.map((row, y) =>
    row.map((p, x) => sigmoid(k * (p - T[y][x]))),
  );
  const dProbability = P.map((row, y) => row.map((p, x) => {
    // σ(z)可能已舍入为1；用exp(-|z|)保留两侧对称的微小导数。
    const tail = Math.exp(-Math.abs(k * (p - T[y][x])));
    return k * tail / (1 + tail) ** 2;
  }));
  return {
    binary,
    dProbability,
    dThreshold: dProbability.map((row) => row.map((x) => -x)),
  };
}

// Stable binary cross-entropy through DB logits, including the chain rule to P and T.
function dbBinaryCrossEntropy(p, t, target, k = 50) {
  probability(p, "p");
  probability(t, "t");
  probability(target, "target");
  sharpness(k);
  const z = k * (p - t),
    b = sigmoid(z);
  const loss = Math.max(z, 0) - z * target + Math.log1p(Math.exp(-Math.abs(z)));
  // 与σ(z)-target代数等价；避开已舍入为1的b再减target导致的尾部消减。
  const residual = z >= 0 ? (1 - target) - sigmoid(-z) : b - target;
  return {
    loss,
    binary: b,
    dProbability: k * residual,
    dThreshold: -k * residual,
  };
}

function boxCheck(box) {
  if (
    !box ||
    ["x0", "y0", "x1", "y1"].some((key) => !Number.isFinite(box[key])) ||
    box.x1 <= box.x0 ||
    box.y1 <= box.y0
  ) {
    throw new RangeError(
      "box must have finite positive-area [x0,y0,x1,y1) coordinates",
    );
  }
  const area = (box.x1 - box.x0) * (box.y1 - box.y0);
  if (!Number.isFinite(area) || area <= 0)
    throw new RangeError("box area is outside the finite numeric range");
}
function boxIoU(a, b) {
  boxCheck(a);
  boxCheck(b);
  const intersection =
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
    Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const areaA = (a.x1 - a.x0) * (a.y1 - a.y0);
  const areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
  // 先按同一面积缩放，避免两个合法大面积相加时溢出。
  const scale = Math.max(areaA, areaB);
  const normalizedIntersection = intersection / scale;
  return normalizedIntersection / (areaA / scale + areaB / scale - normalizedIntersection);
}
function nms(boxes, iouThreshold = 0.3) {
  probability(iouThreshold, "iouThreshold");
  if (!Array.isArray(boxes)) throw new TypeError("boxes must be an array");
  for (const box of boxes) {
    boxCheck(box);
    probability(box.score, "score");
  }
  const pending = boxes
    .map((box, index) => ({ ...box, _index: index }))
    .sort((a, b) => b.score - a.score || a._index - b._index);
  const kept = [];
  for (const candidate of pending) {
    if (kept.every((box) => boxIoU(box, candidate) <= iouThreshold))
      kept.push(candidate);
  }
  return kept.map(({ _index, ...box }) => box);
}

// Four-neighbor connected components and their axis-aligned envelopes. No polygon claim.
// Use P as the inference map, or pass DB's soft binary map explicitly for teaching.
function extractBoxes(
  map,
  {
    threshold = 0.3,
    scoreMap = map,
    minArea = 3,
    minScore = 0.5,
    expandRatio = 0,
  } = {},
) {
  const { width, height } = shape(map);
  const ss = shape(scoreMap, "scoreMap");
  if (ss.width !== width || ss.height !== height)
    throw new RangeError("scoreMap shape differs");
  probability(threshold, "threshold");
  probability(minScore, "minScore");
  finite(expandRatio, "expandRatio");
  if (!Number.isSafeInteger(minArea) || minArea < 1 || expandRatio < 0)
    throw new RangeError("invalid area or expansion");
  const seen = new Uint8Array(width * height),
    boxes = [];
  // Step 1：寻找尚未访问的前景种子。
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (seen[start] || map[y][x] <= threshold) {
        continue;
      }
      const queue = [start];
      seen[start] = 1;
      let x0 = x,
        x1 = x + 1,
        y0 = y,
        y1 = y + 1,
        sum = 0;
      // Step 2：广度优先遍历四邻域；面积与评分只累计组件像素。
      for (let head = 0; head < queue.length; head++) {
        const index = queue[head],
          px = index % width,
          py = Math.floor(index / width);
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px + 1);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py + 1);
        sum += scoreMap[py][px];
        for (const [nx, ny] of [
          [px - 1, py],
          [px + 1, py],
          [px, py - 1],
          [px, py + 1],
        ]) {
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
            const next = ny * width + nx;
            if (!seen[next] && map[ny][nx] > threshold) {
              seen[next] = 1;
              queue.push(next);
            }
          }
        }
      }
      const area = queue.length,
        score = sum / area;
      // Step 3：先过滤，再扩张；扩张不会改变原始组件面积或分数。
      if (area < minArea || score < minScore) {
        continue;
      }
      // A rectangle-only approximation of A*r/L. DB's polygon offset is NOT implemented.
      const distance =
        ((x1 - x0) * (y1 - y0) * expandRatio) / (2 * (x1 - x0 + y1 - y0));
      boxes.push({
        x0: Math.max(0, x0 - distance),
        y0: Math.max(0, y0 - distance),
        x1: Math.min(width, x1 + distance),
        y1: Math.min(height, y1 + distance),
        score,
        area,
      });
    }
  }
  return boxes;
}

// Explicit local convention: theta positive clockwise in image coordinates (x right, y down).
// Distances are measured in image pixels along the rotated local axes; anchor alone uses stride.
function decodeEastRBox(
  { x, y, top, right, bottom, left, angle = 0, score = 1 },
  stride = 4,
) {
  [x, y, top, right, bottom, left, angle, stride].forEach((v) =>
    finite(v, "geometry"),
  );
  probability(score, "score");
  if (
    x < 0 ||
    y < 0 ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    [top, right, bottom, left].some((v) => v < 0) ||
    top + bottom <= 0 ||
    right + left <= 0 ||
    stride <= 0
  ) {
    throw new RangeError("invalid EAST geometry or stride");
  }
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const polygon = [
    [-left, -top],
    [right, -top],
    [right, bottom],
    [-left, bottom],
  ].map(([u, v]) => [x * stride + u * c - v * s, y * stride + u * s + v * c]);
  const box = {
    x0: Math.min(...polygon.map((p) => p[0])),
    y0: Math.min(...polygon.map((p) => p[1])),
    x1: Math.max(...polygon.map((p) => p[0])),
    y1: Math.max(...polygon.map((p) => p[1])),
    score,
    polygon,
  };
  boxCheck(box);
  return box;
}

function mapBoxToOriginal(
  box,
  { scaleX, scaleY, padX = 0, padY = 0, width, height },
) {
  boxCheck(box);
  [scaleX, scaleY, padX, padY, width, height].forEach((x) =>
    finite(x, "image transform"),
  );
  if (
    scaleX <= 0 ||
    scaleY <= 0 ||
    width <= 0 ||
    height <= 0 ||
    padX < 0 ||
    padY < 0
  )
    throw new RangeError("invalid image transform");
  const clip = (x, max) => Math.max(0, Math.min(max, x));
  const mapped = {
    ...box,
    x0: clip((box.x0 - padX) / scaleX, width),
    x1: clip((box.x1 - padX) / scaleX, width),
    y0: clip((box.y0 - padY) / scaleY, height),
    y1: clip((box.y1 - padY) / scaleY, height),
  };
  if (box.polygon) {
    if (
      !Array.isArray(box.polygon) ||
      box.polygon.length < 3 ||
      Array.from(box.polygon).some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          Array.from(p).some((x) => !Number.isFinite(x)),
      )
    )
      throw new TypeError("invalid polygon");
    mapped.polygon = box.polygon.map(([x, y]) => [
      (x - padX) / scaleX,
      (y - padY) / scaleY,
    ]);
  }
  return mapped.x1 > mapped.x0 && mapped.y1 > mapped.y0 ? mapped : null;
}

function createDetectionExample({
  k = 50,
  threshold = 0.3,
  expandRatio = 1,
  blank = false,
} = {}) {
  if (typeof blank !== "boolean") throw new TypeError("blank must be boolean");
  // Analytically defined probability/threshold fields, NOT an image detector.
  const width = 48,
    height = 24;
  const P = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (blank) return 0;
      const band = (cx, cy, rx, ry) =>
        Math.exp(
          -(Math.abs((x - cx) / rx) ** 6 + Math.abs((y - cy) / ry) ** 6),
        );
      return Math.min(
        0.99,
        0.04 + 0.88 * band(12, 8, 9, 3) + 0.76 * band(34, 15, 10, 4),
      );
    }),
  );
  const T = P.map((row, y) =>
    row.map(
      (_, x) => 0.3 + (0.2 * x) / (width - 1) + (0.03 * y) / (height - 1),
    ),
  );
  const db = differentiableBinarize(P, T, k);
  const boxes = nms(extractBoxes(P, { threshold, expandRatio }), 0.3);
  return {
    P,
    T,
    ...db,
    boxes,
    dbBoxes: nms(
      extractBoxes(db.binary, { threshold: 0.5, scoreMap: P, expandRatio }),
      0.3,
    ),
    width,
    height,
  };
}

module.exports = {
  differentiableBinarize,
  dbBinaryCrossEntropy,
  boxIoU,
  nms,
  extractBoxes,
  decodeEastRBox,
  mapBoxToOriginal,
  createDetectionExample,
};
