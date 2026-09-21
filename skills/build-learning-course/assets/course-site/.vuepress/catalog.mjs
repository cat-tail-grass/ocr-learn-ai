import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { projectRoot, readConfig, normalizeBase, withSiteBase } from '../scripts/course-config.mjs';

export { projectRoot, normalizeBase, withSiteBase };
export const courseConfig = readConfig();
export const siteBase = normalizeBase(process.env.SITE_BASE || '/');
export const stages = courseConfig.stages.map((stage, stageIndex) => ({
  id: stageIndex + 1, title: stage.title,
  chapters: stage.lessons.map(lesson => {
    const source = `${lesson.slug}/README.md`;
    const available = lesson.status !== 'planned';
    if (available && !existsSync(path.join(projectRoot, source))) throw new Error(`已生成章节缺少讲义：${source}`);
    const heading = available ? readFileSync(path.join(projectRoot, source), 'utf8').match(/^#\s+(.+)$/m)?.[1] : lesson.title;
    if (!heading) throw new Error(`讲义缺少一级标题：${source}`);
    return {
      ...lesson, id: lesson.slug.split('-')[0], source, available,
      title: heading.replace(/^\d{2,3}[.、\s]+/, ''), shortTitle: lesson.title,
      stage: stage.title, stageIndex: stageIndex + 1,
      docPath: available ? `/${lesson.slug}/` : null,
      labPath: available && lesson.web ? `/labs/${lesson.slug}/index.html` : null,
      runCommand: available && lesson.node ? `node ${lesson.slug}/index.js` : null,
    };
  }),
}));
export const allChapters = stages.flatMap(stage => stage.chapters);
export const chapters = allChapters.filter(chapter => chapter.available);
export const auxiliarySources = ['COURSE_BRIEF.md', 'OUTLINE.md', 'PROGRESS.md'].filter(file => existsSync(path.join(projectRoot, file)));
export const pagePatterns = ['README.md', ...chapters.map(chapter => chapter.source), ...auxiliarySources];
export const sidebar = stages.filter(stage => stage.chapters.some(chapter => chapter.available)).map(stage => ({
  text: `${stage.id}. ${stage.title}`, collapsible: true,
  children: stage.chapters.filter(chapter => chapter.available).map(chapter => ({ text: `${chapter.id} · ${chapter.shortTitle}`, link: chapter.docPath })),
}));
