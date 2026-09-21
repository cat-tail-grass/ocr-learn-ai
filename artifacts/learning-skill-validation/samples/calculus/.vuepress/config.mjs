import { defineUserConfig } from 'vuepress';
import { viteBundler } from '@vuepress/bundler-vite';
import { defaultTheme } from '@vuepress/theme-default';
import { markdownMathPlugin } from '@vuepress/plugin-markdown-math';
import { courseConfig, pagePatterns, sidebar, siteBase, withSiteBase } from './catalog.mjs';
import { coursePagesPlugin } from './plugins/course-pages.mjs';
import { markdownLinksPlugin } from './plugins/markdown-links.mjs';
import { markdownCompatibilityPlugin } from './plugins/markdown-compat.mjs';
import { createCourseSearchPlugin } from './search/options.mjs';

export default defineUserConfig({
  lang: courseConfig.lang || 'zh-CN', title: courseConfig.title, description: courseConfig.description,
  base: siteBase, pagePatterns,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: withSiteBase('/favicon.svg', siteBase) }]],
  host: process.env.SITE_HOST || '127.0.0.1', port: Number(process.env.SITE_PORT || 4173),
  dest: process.env.SITE_DEST || '.vuepress/dist',
  bundler: viteBundler({ viteOptions: {
    server: { strictPort: true },
    plugins: [{ name: 'course-dev-favicon', apply: 'serve', transformIndexHtml: () => [{
      tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: withSiteBase('/favicon.svg', siteBase) }, injectTo: 'head-prepend',
    }] }],
  } }),
  theme: defaultTheme({
    logo: false, colorMode: 'auto', colorModeSwitch: true,
    editLink: false, contributors: false, lastUpdated: false, sidebar, sidebarDepth: 0,
    navbar: [{ text: '学习路径', link: '/' }, { text: '课程大纲', link: '/OUTLINE.html' }],
    toggleColorMode: '切换浅色与深色', toggleSidebar: '打开课程目录',
    prev: '上一章', next: '下一章', pageNavbarLabel: '章节导航',
    tip: '提示', warning: '注意', danger: '警告', backToHome: '返回课程首页',
    notFound: ['这个页面不存在，可以从课程目录继续学习。'], plugins: { git: false },
  }),
  markdown: { headers: { level: [2, 3] }, vPre: { block: true, inline: true } },
  plugins: [coursePagesPlugin(), markdownMathPlugin({ type: 'katex', delimiters: 'all', throwOnError: true }),
    markdownLinksPlugin(), markdownCompatibilityPlugin(), createCourseSearchPlugin()],
});
