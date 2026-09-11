"use strict";
const tf = require("@tensorflow/tfjs");
const { prepareDigit, PREPROCESSING } = require("../shared/17-cnn-classifier");
const { recognizePhoto, PIPELINE_VERSION } = require("../shared/25-ocr-engine");
const { evaluatePredictions } = require("../shared/24-post-processing");
const {
  readRecords,
  saveRecords,
  appendRecord,
} = require("../shared/26-validation");
const $ = (id) => document.getElementById(id);
let model = null,
  modelId = "",
  source = null,
  imageId = "",
  sourceName = "",
  sampleKind = "photo";
let latest = null,
  first = null,
  busy = false;
const MODEL_URL = new URL("../17-cnn-classifier/model/model.json", location.href).href;

function displayImage(canvas, image) {
  canvas.width = image.width;
  canvas.height = image.height;
  canvas
    .getContext("2d")
    .putImageData(
      new ImageData(
        new Uint8ClampedArray(image.data),
        image.width,
        image.height,
      ),
      0,
      0,
    );
}
function status(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
}
function updateControls() {
  $("recognize").disabled = busy || !model || !source;
  $("photo").disabled = busy;
  $("sample").disabled = busy;
  $("reloadModel").disabled = busy;
  for (const id of [
    "experiment",
    "thresholdMethod",
    "angle",
    "autoDeskew",
    "denoise",
  ])
    $(id).disabled = busy;
  $("save").disabled = busy || !first;
  $("compare").disabled = busy || !latest;
}
async function digest(buffer) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
async function loadModel() {
  busy = true;
  updateControls();
  $("modelStatus").textContent = "正在加载与核验模型…";
  try {
    await tf.ready();
    const response = await fetch(MODEL_URL);
    if (!response.ok)
      throw new Error("模型文件尚未准备好，请先完成第 17 章训练");
    const artifact = await response.json();
    const hashes = [];
    for (const group of artifact.weightsManifest || [])
      for (const file of group.paths) {
        const weightResponse = await fetch(
          new URL(file, MODEL_URL),
        );
        if (!weightResponse.ok) throw new Error("模型权重文件无法读取");
        hashes.push(await digest(await weightResponse.arrayBuffer()));
      }
    const loaded = await tf.loadLayersModel(MODEL_URL);
    if (
      loaded.inputs[0].shape.slice(1).join(",") !== "28,28,1" ||
      loaded.outputs[0].shape.at(-1) !== 10
    ) {
      loaded.dispose();
      throw new Error("模型输入输出与数字识别约定不一致");
    }
    if (model) model.dispose();
    model = loaded;
    if (
      artifact.userDefinedMetadata?.weightsSha256 &&
      hashes[0] !== artifact.userDefinedMetadata.weightsSha256
    ) {
      throw new Error("模型权重校验失败，请重新生成或恢复模型文件");
    }
    modelId =
      artifact.userDefinedMetadata?.modelId ||
      "cnn-" +
        (
          await digest(
            new TextEncoder().encode(
              JSON.stringify(artifact) + hashes.join(""),
            ),
          )
        ).slice(0, 16);
    $("modelStatus").textContent =
      `模型已就绪 · ${modelId} · ${tf.getBackend()} · 本项目自行训练`;
  } catch (error) {
    $("modelStatus").textContent =
      `${error.message}。可按本章说明恢复后重新加载。`;
    if (model) model.dispose();
    model = null;
  } finally {
    busy = false;
    updateControls();
  }
}

async function loadPhoto(blob, name, kind) {
  if (blob.size > 20 * 1024 * 1024)
    throw new Error("照片超过 20 MB，请缩小后重试");
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: "from-image",
  });
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    source = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageId = await digest(await blob.arrayBuffer());
    sourceName = name;
    sampleKind = kind;
    latest = null;
    first = null;
    $("result").textContent = "—";
    $("digits").replaceChildren();
    $("comparison").replaceChildren();
    $("sourceLabel").textContent = "";
    $("warnings").textContent = "";
    $("timing").textContent = "";
    $("warnings").textContent = "";
    $("timing").textContent = "";
    $("truth").value = "";
    for (const id of ["binary", "boxes"]) {
      const c = $(id);
      c.getContext("2d").clearRect(0, 0, c.width, c.height);
    }
    displayImage($("original"), source);
    $("sourceLabel").textContent =
      kind === "synthetic-mnist"
        ? `${name} · MNIST 拼接样例，非实拍照片`
        : `${name} · ${bitmap.width} × ${bitmap.height}`;
    status("照片已导入。点击“开始识别”查看模型结果。");
  } finally {
    bitmap.close();
  }
}
async function withInput(loader) {
  busy = true;
  updateControls();
  try {
    await loader();
  } catch (error) {
    // 新输入无法读取时清除旧样本状态，防止把旧预测保存到新照片名下。
    source = null;
    first = null;
    latest = null;
    $("sourceLabel").textContent = "";
    $("warnings").textContent = "";
    $("timing").textContent = "";
    for (const id of ["original", "binary", "boxes"]) {
      const canvas = $(id);
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
    $("result").textContent = "—";
    $("digits").replaceChildren();
    $("comparison").replaceChildren();
    status(`图片读取失败：${error.message}`, true);
  } finally {
    busy = false;
    updateControls();
  }
}
$("photo").addEventListener("change", () => {
  const file = $("photo").files[0];
  if (file) withInput(() => loadPhoto(file, file.name, "photo"));
});
$("sample").addEventListener("click", () =>
  withInput(async () => {
    const response = await fetch(
      new URL("../26-validation/fixtures/development-line.png", location.href),
    );
    if (!response.ok) throw new Error("样例未生成，请运行第 26 章夹具准备命令");
    await loadPhoto(
      await response.blob(),
      "development-line.png",
      "synthetic-mnist",
    );
  }),
);
$("reloadModel").addEventListener("click", loadModel);
$("experiment").addEventListener("change", () => {
  first = null;
  updateControls();
  status("已切换实验轮次。请重新执行识别，以本轮首次结果进行记录。");
});

$("recognize").addEventListener("click", async () => {
  if (!source || !model || busy) return;
  busy = true;
  updateControls();
  status("正在预处理、分割和识别…");
  const config = {
    pipelineVersion: PIPELINE_VERSION,
    thresholdMethod: $("thresholdMethod").value,
    correctionAngle: Number($("angle").value),
    autoDeskew: $("autoDeskew").checked,
    denoise: $("denoise").checked,
    preprocessingId: PREPROCESSING.id,
  };
  await new Promise((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve, 0)),
  );
  try {
    latest = await recognizePhoto(source, {
      ...config,
      prepareDigit,
      predict: (pixels) =>
        tf.tidy(() =>
          Array.from(
            model.predict(tf.tensor4d(pixels, [1, 28, 28, 1])).dataSync(),
          ),
        ),
    });
    $("result").textContent = latest.text || "未识别到数字";
    $("timing").textContent =
      `${latest.characters.length} 个分割区域 · ${latest.elapsedMs} ms · 实际校正 ${latest.correctionAngle}°`;
    $("warnings").textContent = latest.warnings.join(" ");
    displayImage($("binary"), latest.binary);
    displayImage($("boxes"), latest.gray);
    const context = $("boxes").getContext("2d");
    context.strokeStyle = "#16826b";
    context.lineWidth = Math.max(1, source.width / 350);
    context.font = `${Math.max(12, source.width / 45)}px sans-serif`;
    latest.boxes.forEach((box, i) => {
      context.strokeRect(box.x, box.y, box.width, box.height);
      context.fillStyle = "#126451";
      context.fillText(String(i + 1), box.x, Math.max(14, box.y - 4));
    });
    $("digits").replaceChildren();
    for (const char of latest.characters) {
      const item = document.createElement("div");
      item.className = "digit";
      const canvas = document.createElement("canvas");
      displayImage(canvas, char.normalized);
      canvas.setAttribute("aria-label", `归一化数字，预测 ${char.label}`);
      const label = document.createElement("strong");
      label.textContent = char.label;
      const score = document.createElement("small");
      score.textContent = `得分 ${(char.score * 100).toFixed(1)}%`;
      item.title = char.candidates
        .slice(0, 3)
        .map((c) => `${c.label}: ${(c.score * 100).toFixed(1)}%`)
        .join(" / ");
      item.append(canvas, label, score);
      $("digits").append(item);
    }
    $("comparison").replaceChildren();
    if (!first)
      first = {
        id: crypto.randomUUID(),
        imageId,
        filename: sourceName,
        sampleKind,
        modelId,
        pipelineId: (
          await digest(new TextEncoder().encode(JSON.stringify(config)))
        ).slice(0, 12),
        prediction: latest.text,
        truth: null,
        status: latest.status === "empty" ? "failed" : "ok",
        config,
        warnings: latest.warnings,
        createdAt: new Date().toISOString(),
        elapsedMs: latest.elapsedMs,
      };
    status(
      latest.text
        ? "识别完成。请对照实际书写内容。"
        : "未找到有效数字。请保留本次失败，并检查照片或分割参数。",
    );
  } catch (error) {
    latest = { text: "", status: "failed" };
    $("result").textContent = "识别失败";
    $("digits").replaceChildren();
    $("comparison").replaceChildren();
    $("timing").textContent = "";
    $("warnings").textContent = "";
    for (const id of ["binary", "boxes"]) {
      const canvas = $(id);
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
    if (!first)
      first = {
        id: crypto.randomUUID(),
        imageId,
        filename: sourceName,
        sampleKind,
        modelId,
        pipelineId: (
          await digest(new TextEncoder().encode(JSON.stringify(config)))
        ).slice(0, 12),
        prediction: "",
        truth: null,
        status: "failed",
        config,
        error: error.message,
        createdAt: new Date().toISOString(),
      };
    status(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
});

$("compare").addEventListener("click", () => {
  try {
    const truth = $("truth").value;
    if (!/^[0-9]+$/.test(truth))
      throw new Error("请输入非空的正确数字串，只使用 0–9");
    const report = evaluatePredictions([
      { id: "current", truth, prediction: latest.text },
    ]);
    const box = document.createElement("div");
    box.className = "score-result";
    box.textContent = `${report.exactMatches ? "整串完全正确" : "整串有误"} · CER ${(report.microCER * 100).toFixed(1)}% · 替换 ${report.substitutions} / 漏字 ${report.deletions} / 多字 ${report.insertions}`;
    $("comparison").replaceChildren(box);
  } catch (error) {
    status(error.message, true);
  }
});
$("save").addEventListener("click", () => {
  try {
    if (!first) throw new Error("请先识别");
    const truth = $("truth").value,
      experimentId = $("experiment").value.trim();
    if (!experimentId) throw new Error("请填写实验轮次");
    const records = appendRecord(readRecords(localStorage), {
      ...first,
      truth: truth || null,
      experimentId,
    });
    saveRecords(localStorage, records);
    status(
      `已保存本轮首次预测“${first.prediction || "空结果"}”。${truth ? "已记录正确答案。" : "可在评估页补充正确答案。"}`,
    );
  } catch (error) {
    status(`记录未保存：${error.message}`, true);
  }
});
loadModel();
