import { chapters, stages } from '../catalog.mjs';

function neighbor(chapter) {
  return chapter ? { ...chapter, text: `${chapter.id} · ${chapter.shortTitle}`, link: chapter.docPath } : null;
}

export const coursePagesPlugin = () => ({
  name: 'ocr-course-pages',
  extendsPage(page) {
    const source = page.filePathRelative;
    const index = chapters.findIndex(chapter => chapter.source === source);
    page.frontmatter.editLink = false;
    page.frontmatter.contributors = false;
    page.frontmatter.lastUpdated = false;
    if (source === 'README.md') {
      page.data.courseStages = stages;
      page.data.courseCatalog = chapters;
      page.frontmatter.sidebar = false;
      page.frontmatter.prev = false;
      page.frontmatter.next = false;
    } else if (index >= 0) {
      const chapter = chapters[index];
      const course = { ...chapter, courseId: chapter.id, prev: neighbor(chapters[index - 1]), next: neighbor(chapters[index + 1]) };
      page.data.course = course;
      page.data.headers = page.headers;
      page.frontmatter.title = `${chapter.id}. ${chapter.chapterTitle}`;
      page.title = page.frontmatter.title;
      page.data.title = page.title;
      page.frontmatter.prev = course.prev || false;
      page.frontmatter.next = course.next || false;
    } else {
      page.frontmatter.prev = false;
      page.frontmatter.next = false;
    }
  },
});
