import { markdownMathPlugin } from '@vuepress/plugin-markdown-math';
import { markdownLinksPlugin } from './plugins/markdown-links.mjs';
import { markdownCompatibilityPlugin } from './plugins/markdown-compat.mjs';
import { createCourseSearchPlugin } from './search/options.mjs';

// 保留原 README 的两种公式语法；ASCII 算式与代码继续按原文展示。
export const courseMathOptions = { type: 'katex', delimiters: 'all', throwOnError: true };

export const createCourseContentPlugins = () => [
  markdownMathPlugin(courseMathOptions),
  markdownLinksPlugin(),
  markdownCompatibilityPlugin(),
  createCourseSearchPlugin(),
];
