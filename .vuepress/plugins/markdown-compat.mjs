import { fileURLToPath } from 'node:url';

export const markdownCompatibilityPlugin = () => ({
  name: 'ocr-course-markdown-compatibility',
  extendsMarkdownOptions(options) {
    // Native details/summary stay interactive; braces in examples remain literal.
    options.html = true;
    options.vPre = { block: true, inline: true };
  },
  clientConfigFile: fileURLToPath(new URL('../search/client.mjs', import.meta.url)),
});
