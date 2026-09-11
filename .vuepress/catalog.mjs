import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

// 课程顺序与阶段在此维护；正文及标题始终读取原章节 README。
const groups = [
  ['基础准备', ['01-image-fundamentals', '02-js-image-basics']],
  ['图像预处理', ['03-grayscale', '04-binarization', '05-denoising', '06-morphology', '07-deskewing']],
  ['文本检测', ['08-edge-detection', '09-connected-components', '10-text-localization']],
  ['传统识别', ['11-feature-extraction', '12-template-matching', '13-knn-classifier']],
  ['深度学习基础', ['14-neural-network-basics', '15-cnn-basics', '16-tensorflowjs-intro']],
  ['深度学习 OCR', ['17-cnn-classifier', '18-rnn-basics', '19-ctc-loss', '20-crnn', '21-attention']],
  ['现代 OCR', ['22-text-detection-networks', '23-transformer-ocr']],
  ['自主引擎开发', ['24-post-processing', '25-ocr-engine', '26-validation']],
];

export const chapters = groups.flatMap(([stage, slugs], stageIndex) => slugs.map(slug => {
  const source = `${slug}/README.md`;
  const heading = readFileSync(new URL(`../${source}`, import.meta.url), 'utf8').match(/^#\s+(.+)$/m)?.[1];
  if (!heading) throw new Error(`课程缺少一级标题：${source}`);
  const title = heading.replace(/^\d{2}[.、\s]+/, '').trim();
  return {
    id: slug.slice(0, 2), slug, stage, stageIndex: stageIndex + 1, source,
    title, chapterTitle: title, shortTitle: title.split(/\s*[:：（(]/)[0],
    docPath: `/${slug}/`, labPath: `/labs/${slug}/index.html`,
    nodeCommand: `node ${slug}/index.js`,
  };
}));

if (chapters.length !== 26 || new Set(chapters.map(chapter => chapter.id)).size !== 26) {
  throw new Error('课程目录必须包含唯一、连续的 01–26 章');
}

export const stages = groups.map(([title], index) => ({
  id: index + 1, title, chapters: chapters.filter(chapter => chapter.stageIndex === index + 1),
}));

export const auxiliarySources = [
  'OUTLINE.md', 'PROGRESS.md', 'shared/README.md',
  'docs/COURSE_STANDARD.md', 'docs/COURSE_REVIEW.md', 'docs/SHARING_GUIDE.md',
  'docs/VUEPRESS_INTEGRATION_PLAN.md', 'docs/VUEPRESS_INTEGRATION_REPORT.md',
  'docs/reviews/2026-09-11/README.md',
  ...['01-05', '06-10', '11-13', '14-17', '18-20', '21-24', '25-26'].map(part => `docs/reviews/2026-09-11/${part}.md`),
];
export const pagePatterns = ['README.md', ...chapters.map(chapter => chapter.source), ...auxiliarySources];

// 文档组件通过 VuePress withBase 使用路径；构建脚本和 Markdown 插件使用相同规则。
export function normalizeBase(value = '/') {
  if (!value.startsWith('/') || /[?#\\]|\.{2}/.test(value)) throw new Error(`无效的站点 base：${value}`);
  return `/${value.split('/').filter(Boolean).join('/')}${value.split('/').filter(Boolean).length ? '/' : ''}`;
}
export function withSiteBase(route, base = process.env.SITE_BASE || '/') {
  return normalizeBase(base) + route.replace(/^\/+/, '');
}
export const siteBase = normalizeBase(process.env.SITE_BASE || '/');
export const sidebar = stages.map(stage => ({
  text: `${stage.id}. ${stage.title}`, collapsible: true,
  children: stage.chapters.map(chapter => ({ text: `${chapter.id} · ${chapter.shortTitle}`, link: chapter.docPath })),
}));
