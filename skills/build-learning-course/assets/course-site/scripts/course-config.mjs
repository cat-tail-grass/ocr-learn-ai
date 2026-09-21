import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const lessonPattern = /^\d{2,3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isMainModule(url) {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(url)); }
  catch { return false; }
}

export function inside(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes('\0') || path.isAbsolute(relative)) throw new Error(`需要项目内的相对路径：${relative}`);
  const resolved = path.resolve(root, relative);
  if (resolved === path.resolve(root) || !resolved.startsWith(path.resolve(root) + path.sep)) throw new Error(`路径超出项目：${relative}`);
  return resolved;
}

export function existingInside(root, relative) {
  const resolved = realpathSync(inside(root, relative));
  if (!resolved.startsWith(realpathSync(root) + path.sep)) throw new Error(`链接指向项目之外：${relative}`);
  return resolved;
}

export function validateConfig(config) {
  if (config?.schemaVersion !== 1) throw new Error('course.json 的 schemaVersion 必须为 1');
  for (const field of ['title', 'description', 'audience', 'outcome']) {
    if (typeof config[field] !== 'string' || !config[field].trim()) throw new Error(`course.json 缺少 ${field}`);
  }
  if (!Array.isArray(config.stages) || !config.stages.length) throw new Error('至少需要一个学习阶段');
  if (config.terms !== undefined && (!Array.isArray(config.terms) || config.terms.some(term => typeof term !== 'string' || !term.trim()))) throw new Error('terms 应为非空术语字符串的数组');
  const lessons = [], ids = new Set();
  for (const stage of config.stages) {
    if (!stage.title?.trim() || !Array.isArray(stage.lessons) || !stage.lessons.length) throw new Error('每个阶段需要标题和章节');
    for (const lesson of stage.lessons) {
      if (!lessonPattern.test(lesson.slug) || ids.has(lesson.slug)) throw new Error(`无效或重复的章节目录：${lesson.slug}`);
      if (!lesson.title?.trim()) throw new Error(`${lesson.slug} 缺少标题`);
      if (!['planned', 'draft', 'verified'].includes(lesson.status)) throw new Error(`${lesson.slug} 的状态应为 planned/draft/verified`);
      if (!Array.isArray(lesson.prerequisites)) throw new Error(`${lesson.slug} 需要 prerequisites 数组`);
      if (typeof lesson.web !== 'boolean' || typeof lesson.node !== 'boolean') throw new Error(`${lesson.slug} 需要 web/node 布尔值`);
      ids.add(lesson.slug); lessons.push(lesson);
    }
  }
  if (lessons.some((lesson, index) => Number(lesson.slug.split('-')[0]) !== index + 1)) throw new Error('章节编号应从 01 起按路线连续排列；章节数量不限');
  const previous = new Set();
  for (const lesson of lessons) {
    for (const prerequisite of lesson.prerequisites) {
      if (!previous.has(prerequisite)) throw new Error(`${lesson.slug} 的前置章节 ${prerequisite} 不存在或尚在其后`);
    }
    previous.add(lesson.slug);
  }
  if (!['pending', 'approved'].includes(config.calibration?.status) || !ids.has(config.calibration?.lesson)) throw new Error('calibration 需要有效的 lesson 和 pending/approved 状态');
  if (config.calibration.status === 'approved' && !config.calibration.feedback?.trim()) throw new Error('校准通过后，应在 calibration.feedback 记录使用者认可的尺度');
  return lessons;
}

export function readConfig(root = projectRoot) {
  const config = JSON.parse(readFileSync(path.join(root, 'course.json'), 'utf8'));
  validateConfig(config);
  return config;
}

export function normalizeBase(value = '/') {
  if (!value.startsWith('/') || /[?#\\]|\.{2}/.test(value)) throw new Error(`无效的站点 base：${value}`);
  const segments = value.split('/').filter(Boolean);
  return '/' + segments.join('/') + (segments.length ? '/' : '');
}
export const withSiteBase = (route, base = '/') => normalizeBase(base) + route.replace(/^\/+/, '');
