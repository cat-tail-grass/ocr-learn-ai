import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { projectRoot, readConfig, existingInside, inside, isMainModule } from './course-config.mjs';

export function checkCourse(root = projectRoot, { execute = false, timeout = 30000 } = {}) {
  const config = readConfig(root);
  const lessons = config.stages.flatMap(stage => stage.lessons);
  const report = { createdAt: new Date().toISOString(), scope: '结构、相对文件链接和可选 Node 运行；不评判教学质量与浏览器交互', failures: [], lessons: [] };
  const documents = ['README.md', 'COURSE_BRIEF.md', 'OUTLINE.md', 'PROGRESS.md'];
  const hash = text => createHash('sha256').update(text).digest('hex');
  for (const lesson of lessons) {
    if (lesson.status === 'planned') continue;
    const row = { slug: lesson.slug, node: lesson.node ? 'not-run' : 'not-applicable', browser: lesson.web ? 'requires-browser-review' : 'not-applicable', teaching: 'requires-review', files: {} };
    report.lessons.push(row);
    for (const file of ['README.md', ...(lesson.web ? ['index.html'] : []), ...(lesson.node ? ['index.js'] : [])]) {
      try {
        const content = readFileSync(existingInside(root, `${lesson.slug}/${file}`), 'utf8');
        row.files[file] = hash(content);
        if (!content.trim()) report.failures.push(`${lesson.slug}/${file} 为空`);
        if (/\[TODO\b|\{\{(?:TOPIC|LESSON|TITLE|REPLACE)[^}]*\}\}/i.test(content)) report.failures.push(`${lesson.slug}/${file} 含未替换模板`);
      } catch (error) { report.failures.push(`${lesson.slug}/${file}：${error.message}`); }
    }
    documents.push(`${lesson.slug}/README.md`);
    if (lesson.status === 'verified' && !existsSync(inside(root, `reviews/${lesson.slug}.md`))) report.failures.push(`${lesson.slug} 标记 verified 但没有 reviews/${lesson.slug}.md`);
    if (execute && lesson.node && row.files['index.js']) {
      const result = spawnSync(process.execPath, [inside(root, `${lesson.slug}/index.js`)], { cwd: root, encoding: 'utf8', timeout, maxBuffer: 2 * 1024 * 1024 });
      row.node = result.status === 0 && !result.error ? 'passed' : 'failed';
      row.exitCode = result.status;
      row.output = (result.stdout || '') + (result.stderr || '');
      if (result.error) row.error = result.error.message;
      if (row.node === 'failed') report.failures.push(`${lesson.slug} Node 执行失败：${row.error || result.status}`);
    }
  }
  for (const relative of documents) {
    let markdown;
    try { markdown = readFileSync(existingInside(root, relative), 'utf8'); }
    catch { report.failures.push(`缺少文档：${relative}`); continue; }
    const prose = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
    for (const match of prose.matchAll(/!?\[[^\]\n]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g)) {
      const href = match[1];
      if (/^(?:#|\?|\/|[a-z][a-z\d+.-]*:)/i.test(href)) continue;
      const target = decodeURIComponent(href.split(/[?#]/)[0]);
      if (!target) continue;
      try { existingInside(root, path.posix.join(path.posix.dirname(relative), target)); }
      catch { report.failures.push(`${relative} 链接目标不存在或越界：${href}`); }
    }
  }
  return report;
}

if (isMainModule(import.meta.url)) {
  try {
    const unsupported = process.argv.slice(2).filter(arg => arg !== '--execute');
    if (unsupported.length) throw new Error(`未知参数：${unsupported.join(' ')}`);
    const report = checkCourse(projectRoot, { execute: process.argv.includes('--execute') });
    const output = path.join(projectRoot, '.course-checks');
    mkdirSync(output, { recursive: true });
    writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    for (const lesson of report.lessons) console.log(`${lesson.slug}：Node ${lesson.node}；教学和浏览器请审查实际内容`);
    for (const failure of report.failures) console.error(failure);
    console.log(`机械检查 ${report.failures.length ? '未通过' : '通过'}；报告 .course-checks/report.json`);
    if (report.failures.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
