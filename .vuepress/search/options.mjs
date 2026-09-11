import { pagePatterns } from '../catalog.mjs';
import { slimsearchPlugin } from '@vuepress/plugin-slimsearch';
import { tokenizeCourseText } from './tokenize.mjs';
import { extractCourseSearchField } from './text.mjs';

export const courseSearchOptions = {
  indexContent: true,
  hotReload: true,
  searchDelay: 120,
  // rc.134 forwards these options to slimsearch.createIndex, whose extractField
  // hook normalizes both stored snippets and the text used for tokenization.
  indexOptions: { tokenize: tokenizeCourseText, extractField: extractCourseSearchField },
  filter: page => pagePatterns.includes(page.filePathRelative),
  locales: {
    '/': {
      placeholder: '搜索课程与正文', search: '搜索课程', clear: '清除搜索文字',
      remove: '删除当前项目', searching: '正在搜索', cancel: '取消', defaultTitle: 'OCR 课程',
      select: '选择', navigate: '切换结果', autocomplete: '自动补全', exit: '关闭',
      loading: '正在加载课程索引…', queryHistory: '搜索历史', resultHistory: '最近阅读的搜索结果',
      emptyHistory: '输入中文概念或英文术语开始搜索', emptyResult: '没有找到相关课程，请尝试其他词语',
    },
  },
};

export const createCourseSearchPlugin = () => app => {
  const plugin = slimsearchPlugin(courseSearchOptions)(app);
  return {
    ...plugin,
    async onPageUpdated() {
      // rc.134's incremental removal compares IDs by prefix (1 also removes 10–19).
      // Rebuild this small course corpus so editing one README preserves every chapter.
      await plugin.onInitialized();
      await plugin.onPrepared();
    },
  };
};
