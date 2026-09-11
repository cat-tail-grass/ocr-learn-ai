/** Explicit runtime and linked reading assets; no MNIST cache or historical logs. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chapters, projectRoot, normalizeBase } from '../.vuepress/catalog.mjs';

export { projectRoot, normalizeBase as normalizeSiteBase };
export const chapterSlugs = Object.freeze(chapters.map(chapter => chapter.slug));
const bundledChapterIds = new Set([
  '02', '03', '04', '05', '06', '07', '08', '09', '10', '14', '15',
  '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26',
]);
export const browserEntries = Object.freeze(chapterSlugs
  .filter(slug => bundledChapterIds.has(slug.slice(0, 2)))
  .map(slug => `${slug}/browser.js`));
export const assetGroups = Object.freeze({
  experiments: chapterSlugs.map(slug => `${slug}/index.html`),
  bundles: browserEntries.map(entry => entry.replace(/browser\.js$/, 'bundle.js')),
  shared: [
    'shared/course.css',
    'shared/course.js',
    'shared/11-feature-extraction/index.js',
    'shared/12-template-matching/index.js',
    'shared/13-knn-classifier/index.js',
    'shared/13-knn-classifier/demoDataset.js',
  ],
  cnn: [
    '17-cnn-classifier/train.html',
    '17-cnn-classifier/model/model.json',
    '17-cnn-classifier/model/weights.bin',
    '17-cnn-classifier/model/config.json',
    '17-cnn-classifier/model/inference-verification.json',
    '17-cnn-classifier/model/split.json',
    '17-cnn-classifier/model/test-predictions.json',
    '17-cnn-classifier/model/training-curve.json',
    '17-cnn-classifier/model/training-report.json',
    '17-cnn-classifier/validation-samples.json',
  ],
  crnn: ['20-crnn/model/weights.json', '20-crnn/training-report.json'],
  samples: ['26-validation/fixtures/development-line.png'],
  readingResources: [
    '24-post-processing/browser-qa-results.json',
    '24-post-processing/browser-qa-desktop.png',
    '25-ocr-engine/index.js',
    '26-validation/index.js',
    '26-validation/development-report.json',
    '26-validation/test-report.json',
    '26-validation/test-freeze.json',
    '26-validation/test-manifest.json',
    'shared/24-post-processing/index.js',
    'shared/25-ocr-engine/index.js',
    'shared/26-validation/index.js',
  ],
});
export const labAssets = Object.freeze(Object.entries(assetGroups).flatMap(([group, sources]) =>
  sources.map(source => Object.freeze({ source, destination: source, group }))));

export function resolveSiteOptions(options = {}) {
  const root = path.resolve(options.root || projectRoot);
  const base = normalizeBase(options.base ?? process.env.SITE_BASE ?? '/');
  const port = Number(options.port ?? process.env.SITE_PORT ?? 4173);
  const host = String(options.host ?? process.env.SITE_HOST ?? '127.0.0.1');
  const dest = path.resolve(root, options.dest ?? process.env.SITE_DEST ?? '.vuepress/dist');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SITE_PORT 必须是 1–65535 的整数');
  if (!host || /[\s/\\]/.test(host)) throw new Error('SITE_HOST 必须是有效的主机名或地址');
  if (root === dest || root.startsWith(`${dest}${path.sep}`)) throw new Error('SITE_DEST 不可是源码根目录或其父目录');
  return { root, base, port, host, dest };
}

export function isMainModule(url) {
  return Boolean(process.argv[1]) && fileURLToPath(url) === path.resolve(process.argv[1]);
}
