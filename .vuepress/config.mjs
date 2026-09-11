import { defineUserConfig } from 'vuepress';
import { viteBundler } from '@vuepress/bundler-vite';
import { defaultTheme } from '@vuepress/theme-default';
import { pagePatterns, sidebar, siteBase, withSiteBase } from './catalog.mjs';
import { coursePagesPlugin } from './plugins/course-pages.mjs';
import { createCourseContentPlugins } from './content-config.mjs';

export default defineUserConfig({
  lang: 'zh-CN', title: 'OCR 学习实验室',
  description: '从像素到手写数字串：26 章完整讲义、交互实验与自主 OCR 引擎。',
  base: siteBase, pagePatterns,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: withSiteBase('/favicon.svg', siteBase) }]],
  host: process.env.SITE_HOST || '127.0.0.1', port: Number(process.env.SITE_PORT || 4173),
  dest: process.env.SITE_DEST || '.vuepress/dist',
  bundler: viteBundler({ viteOptions: {
    server: { strictPort: true },
    // 开发模式的空 HTML 早于 VuePress 客户端 head 挂载；提前声明图标，
    // 避免浏览器首次访问子目录时自动请求站点根部 /favicon.ico。
    plugins: [{
      name: 'course-dev-favicon', apply: 'serve',
      transformIndexHtml: () => [{
        tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: withSiteBase('/favicon.svg', siteBase) },
        injectTo: 'head-prepend',
      }],
    }],
  } }),
  theme: defaultTheme({
    logo: false, colorMode: 'auto', colorModeSwitch: true,
    repo: 'cat-tail-grass/ocr-learn-ai', repoLabel: '源码',
    editLink: false, contributors: false, lastUpdated: false,
    sidebar, sidebarDepth: 0,
    navbar: [
      { text: '课程', link: '/' },
      { text: '实验目录', link: '/#course-catalog' },
      { text: '分享指南', link: '/docs/SHARING_GUIDE.html' },
      { text: '勘误记录', link: '/docs/reviews/2026-09-11/' },
    ],
    selectLanguageName: '简体中文', selectLanguageText: '选择语言',
    toggleColorMode: '切换浅色与深色', toggleSidebar: '打开课程目录',
    prev: '上一章', next: '下一章', pageNavbarLabel: '章节导航',
    tip: '提示', warning: '注意', danger: '警告',
    backToHome: '返回课程首页', notFound: ['这个页面不存在，可以从课程目录继续学习。'],
    plugins: { git: false },
  }),
  markdown: { headers: { level: [2, 3] }, vPre: { block: true, inline: true } },
  plugins: [coursePagesPlugin(), ...createCourseContentPlugins()],
});
