import { chapters, stages, allChapters, courseConfig } from '../catalog.mjs';
const neighbor = chapter => chapter ? { ...chapter, text: `${chapter.id} · ${chapter.shortTitle}`, link: chapter.docPath } : null;

export const coursePagesPlugin = () => ({
  name: 'learning-course-pages',
  extendsPage(page) {
    const source = page.filePathRelative;
    const index = chapters.findIndex(chapter => chapter.source === source);
    Object.assign(page.frontmatter, { editLink: false, contributors: false, lastUpdated: false, prev: false, next: false });
    if (source === 'README.md') {
      Object.assign(page.data, { courseStages: stages, courseCatalog: allChapters, courseDescription: courseConfig.description });
      page.frontmatter.sidebar = false;
    } else if (index >= 0) {
      const chapter = chapters[index];
      const course = { ...chapter, prev: neighbor(chapters[index - 1]), next: neighbor(chapters[index + 1]) };
      Object.assign(page.data, { course, headers: page.headers, title: `${chapter.id}. ${chapter.title}` });
      Object.assign(page.frontmatter, { title: page.data.title, prev: course.prev || false, next: course.next || false });
      page.title = page.data.title;
    }
  },
});
