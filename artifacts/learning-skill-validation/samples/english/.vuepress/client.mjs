import { defineClientConfig } from 'vuepress/client';
import CourseLayout from './components/CourseLayout.vue';
import CourseCatalog from './components/CourseCatalog.vue';

export default defineClientConfig({
  layouts: { Layout: CourseLayout },
  enhance({ app }) { app.component('CourseCatalog', CourseCatalog); },
});
