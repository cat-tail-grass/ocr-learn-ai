import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { existingInside, projectRoot, readConfig } from './course-config.mjs';

const excluded = new Set(['node_modules', '__tests__', '.git', '.course-checks', 'reviews']);
const extensions = new Set(['.html', '.js', '.mjs', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.json', '.mp3', '.wav', '.ogg', '.pdf', '.md', '.txt', '.csv', '.py']);

export function copyLearningAssets(root, relative, destination) {
  const source = existingInside(root, relative);
  const metadata = lstatSync(path.join(root, relative));
  if (metadata.isSymbolicLink()) throw new Error(`请将实验资源实际放在课程目录内：${relative}`);
  if (metadata.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source)) {
      if (entry.startsWith('.') || excluded.has(entry)) continue;
      copyLearningAssets(root, `${relative}/${entry}`, path.join(destination, entry));
    }
  } else if (extensions.has(path.extname(source).toLowerCase())) {
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
}

export function prepareLabs(root = projectRoot) {
  const config = readConfig(root);
  const lessons = config.stages.flatMap(stage => stage.lessons).filter(lesson => lesson.status !== 'planned');
  for (const lesson of lessons) {
    for (const file of ['README.md', ...(lesson.web ? ['index.html'] : []), ...(lesson.node ? ['index.js'] : [])]) existingInside(root, `${lesson.slug}/${file}`);
  }
  const output = path.join(root, '.vuepress/public/labs');
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const lesson of lessons) copyLearningAssets(root, lesson.slug, path.join(output, lesson.slug));
  if (existsSync(path.join(root, 'shared'))) copyLearningAssets(root, 'shared', path.join(output, 'shared'));
  writeFileSync(path.join(output, 'catalog.json'), JSON.stringify(lessons.map(({ slug, title, web }) => ({ slug, title, web })), null, 2));
  writeFileSync(path.join(root, '.vuepress/search/terms.mjs'), `export default ${JSON.stringify(config.terms || [])};\n`);
  return output;
}
