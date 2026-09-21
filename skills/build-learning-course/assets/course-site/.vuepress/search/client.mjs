import { defineClientConfig } from 'vuepress/client';
import { defineSearchConfig } from '@vuepress/plugin-slimsearch/client';
import { splitCourseQuery } from './tokenize.mjs';

defineSearchConfig({ querySplitter: splitCourseQuery, combineWith: 'and', prefix: true, fuzzy: false });

export default defineClientConfig({});
