const {
  differentiableBinarize: db,
  dbBinaryCrossEntropy: bce,
  extractBoxes,
  boxIoU,
  nms,
  decodeEastRBox,
  mapBoxToOriginal,
  createDetectionExample,
} = require("../22-text-detection-networks");

describe("22 DB operation and explicitly limited geometry post-processing", () => {
  test("DB equality, sign, saturation and analytical derivative", () => {
    const r = db([[0.3, 0.5, 0.7]], [[0.5, 0.5, 0.5]], 50);
    expect(r.binary[0][1]).toBe(0.5);
    expect(r.dProbability[0][1]).toBe(12.5);
    expect(r.dThreshold[0][1]).toBe(-12.5);
    expect(r.binary[0][0]).toBeCloseTo(0.0000453978687, 12);
    expect(r.binary[0][2]).toBeCloseTo(0.9999546021313, 12);
    expect(db([[0, 1]], [[1, 0]], 1000).binary).toEqual([[0, 1]]);
  });
  test.each(["p", "t"])(
    "DB + BCE chain derivative w.r.t. %s matches finite difference",
    (variable) => {
      const p = 0.51,
        t = 0.48,
        epsilon = 1e-6,
        k = 12;
      const r = bce(p, t, 1, k);
      const numerical =
        variable === "p"
          ? (bce(p + epsilon, t, 1, k).loss - bce(p - epsilon, t, 1, k).loss) /
            (2 * epsilon)
          : (bce(p, t + epsilon, 1, k).loss - bce(p, t - epsilon, 1, k).loss) /
            (2 * epsilon);
      expect(variable === "p" ? r.dProbability : r.dThreshold).toBeCloseTo(
        numerical,
        7,
      );
      expect(Number.isFinite(bce(0, 1, 1, 1000).loss)).toBe(true);
    },
  );
  test("four-neighbor components, exclusive bounds, component score and area rejection", () => {
    const map = [
      [0.9, 0.9, 0, 0],
      [0.9, 0.9, 0, 0.9],
      [0, 0, 0.9, 0.9],
    ];
    const boxes = extractBoxes(map, { threshold: 0.5, minArea: 3 });
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ x0: 0, y0: 0, x1: 2, y1: 2, area: 4 });
    expect(boxes[1]).toMatchObject({ x0: 2, y0: 1, x1: 4, y1: 3, area: 3 });
    expect(extractBoxes(map, { minArea: 4 })).toHaveLength(1);
    expect(extractBoxes([[0.5]], { threshold: 0.5, minArea: 1 })).toEqual([]);
    expect(
      extractBoxes([
        [0, 0],
        [0, 0],
      ]),
    ).toEqual([]);
  });
  test("separate score map filters apparent DB activation and expansion clips to map", () => {
    expect(
      extractBoxes([[0.99, 0.99]], {
        minArea: 1,
        scoreMap: [[0.2, 0.2]],
        minScore: 0.5,
      }),
    ).toEqual([]);
    const [box] = extractBoxes(
      [
        [0.9, 0.9],
        [0.9, 0.9],
      ],
      { expandRatio: 20 },
    );
    expect(box).toMatchObject({ x0: 0, y0: 0, x1: 2, y1: 2 });
  });
  test("IoU from continuous exclusive geometry and stable NMS without input mutation", () => {
    const a = { x0: 0, y0: 0, x1: 4, y1: 4, score: 0.9, id: "a" };
    const b = { x0: 2, y0: 0, x1: 6, y1: 4, score: 0.8, id: "b" };
    expect(boxIoU(a, b)).toBeCloseTo(1 / 3, 12);
    const boxes = [b, a],
      copy = JSON.stringify(boxes);
    expect(nms(boxes, 0.3).map((x) => x.id)).toEqual(["a"]);
    expect(nms(boxes, 0.4)).toHaveLength(2);
    expect(JSON.stringify(boxes)).toBe(copy);
    expect(nms([])).toEqual([]);
  });
  test("EAST distances do not get multiplied by stride, with clockwise pi/2 rotation", () => {
    const geom = { x: 2, y: 3, top: 1, right: 3, bottom: 2, left: 2 };
    expect(decodeEastRBox(geom).polygon).toEqual([
      [6, 11],
      [11, 11],
      [11, 14],
      [6, 14],
    ]);
    const r = decodeEastRBox({ ...geom, angle: Math.PI / 2 });
    const expected = [
      [9, 10],
      [9, 15],
      [6, 15],
      [6, 10],
    ];
    r.polygon.forEach((p, i) =>
      p.forEach((x, j) => expect(x).toBeCloseTo(expected[i][j], 12)),
    );
  });
  test("undo padding then scaling; fully padded boxes become null", () => {
    const transform = {
      scaleX: 2,
      scaleY: 2,
      padX: 4,
      padY: 6,
      width: 20,
      height: 10,
    };
    expect(
      mapBoxToOriginal({ x0: 8, y0: 10, x1: 20, y1: 18 }, transform),
    ).toEqual({ x0: 2, y0: 2, x1: 8, y1: 6 });
    expect(
      mapBoxToOriginal({ x0: 0, y0: 0, x1: 2, y1: 3 }, transform),
    ).toBeNull();
  });
  test("synthetic experiment produces two retained regions on default P", () => {
    const r = createDetectionExample();
    expect(r.boxes).toHaveLength(2);
    expect(r.dbBoxes).toHaveLength(2);
    expect(r).toEqual(createDetectionExample());
    expect(createDetectionExample({ blank: true }).boxes).toEqual([]);
    expect(createDetectionExample({ blank: true }).dbBoxes).toEqual([]);
  });
  test("rejects invalid maps, geometry, scores and thresholds", () => {
    expect(() => db([[1]], [[0, 0]])).toThrow(/shapes/);
    expect(() => db([[NaN]], [[0]])).toThrow();
    expect(() => db([[1]], [[0]], 0)).toThrow();
    expect(() => extractBoxes([[1]], { threshold: 2 })).toThrow();
    expect(() => extractBoxes([[1], []])).toThrow();
    expect(() => nms([{ x0: 0, y0: 0, x1: 0, y1: 1, score: 1 }])).toThrow();
    expect(() =>
      decodeEastRBox({ x: 0, y: 0, top: -1, right: 1, bottom: 1, left: 1 }),
    ).toThrow();
  });
  test("DB tails keep symmetric nonzero gradients when positive sigmoid rounds to one", () => {
    const r = db([[0, 1]], [[1, 0]], 50);
    const expected = 50 * Math.exp(-50) / (1 + Math.exp(-50)) ** 2;
    expect(r.binary[0][1]).toBe(1); // 展示值舍入不应使解析导数提前变零。
    for (const derivative of r.dProbability[0]) {
      expect(derivative / expected).toBeCloseTo(1, 14);
    }
    expect(bce(1, 0, 1, 50).dProbability / (-50 * Math.exp(-50))).toBeCloseTo(1, 14);
    // 用仍可分辨的稳定BCE损失差分独立检查正尾部梯度。
    const p = 0.9, epsilon = 1e-6;
    const numerical = (bce(p + epsilon, 0, 1, 50).loss - bce(p - epsilon, 0, 1, 50).loss) / (2 * epsilon);
    expect(bce(p, 0, 1, 50).dProbability / numerical).toBeCloseTo(1, 7);
  });
  test("sparse probability maps cannot generate fake NaN-scored detections", () => {
    expect(() => extractBoxes([new Array(1)], { minArea: 1 })).toThrow();
    expect(() => db([[1, , 0]], [[0, 0, 0]])).toThrow();
    expect(() => extractBoxes([[0.9], , [0.9]], { minArea: 1 })).toThrow();
  });
  test("IoU remains one for identical large finite-area boxes and rejects unrepresentable areas", () => {
    const large = { x0: 0, y0: 0, x1: 1e154, y1: 1e154, score: 0.9 };
    expect(boxIoU(large, large)).toBe(1);
    expect(nms([large, { ...large, score: 0.8 }])).toHaveLength(1);
    const overflow = { x0: 0, y0: 0, x1: 1e200, y1: 1e200 };
    expect(() => boxIoU(overflow, overflow)).toThrow(/area/);
  });
});
