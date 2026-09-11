/**
 * 批量评估在加载模型、写冻结记录之前验证样本清单。
 * 逐条路径与来源去重属于评估分母的约束，不能只在网页导入时检查。
 */
const path = require("node:path");
const { validateRecords } = require("../shared/26-validation");

function validateManifest(manifest, directory) {
  if (!manifest || !Array.isArray(manifest.rows) || !manifest.rows.length)
    throw new Error("清单应有非空 rows 数组");
  const mode = manifest.mode || "photo";
  if (typeof mode !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(mode))
    throw new Error("清单 mode 应为 1–80 位字母、数字、连字符或下划线，首位须为字母或数字");
  const paths = new Set();
  const rows = manifest.rows.map((row) => {
    if (!row || typeof row.path !== "string" || !row.path.trim())
      throw new Error("每条清单记录须有非空图片 path");
    const file = path.resolve(directory, row.path);
    if (paths.has(file)) throw new Error("清单包含重复的图片路径，不能将重试当作独立样本");
    paths.add(file);
    return { ...row, sampleKind: row.sampleKind || "unknown" };
  });
  // 预测尚未执行，空串仅用于复用记录结构、真值和同源重复校验，不能作为结果保存。
  validateRecords(rows.map((row) => ({ ...row, prediction: "", experimentId: `${mode}-frozen-v1` })));
  return { ...manifest, mode, rows };
}

module.exports = { validateManifest };
