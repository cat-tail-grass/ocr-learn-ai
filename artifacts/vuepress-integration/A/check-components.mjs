import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { version } from 'vue';
import { parse, compileScript, compileTemplate, compileStyle } from '@vue/compiler-sfc';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const results = [];
for (const filename of ['CourseLayout.vue', 'CourseCatalog.vue', 'CourseToc.vue']) {
  const file = `.vuepress/components/${filename}`;
  const source = readFileSync(resolve(projectRoot, file), 'utf8');
  const parsed = parse(source, { filename });
  if (parsed.errors.length) throw new Error(JSON.stringify(parsed.errors));
  const script = compileScript(parsed.descriptor, { id: filename });
  const template = compileTemplate({
    source: parsed.descriptor.template.content,
    filename,
    id: filename,
    compilerOptions: { bindingMetadata: script.bindings },
  });
  if (template.errors.length) throw new Error(JSON.stringify(template.errors));
  if (/from\s+['"][^'"]*catalog/.test(source) || /node:fs/.test(source)) {
    throw new Error(`${filename}: Node-only import`);
  }
  results.push({ file, script: 'PASS', template: 'PASS', nodeOnlyImports: 'none' });
}

const stylesheet = compileStyle({
  source: readFileSync(resolve(projectRoot, '.vuepress/styles/course.css'), 'utf8'),
  filename: 'course.css',
  id: 'course',
});
if (stylesheet.errors.length) throw new Error(JSON.stringify(stylesheet.errors));
results.push({ file: '.vuepress/styles/course.css', parse: 'PASS' });
results.push({ themeLayout: import.meta.resolve('@vuepress/theme-default/layouts/Layout.vue') });

const report = { checkedAt: new Date().toISOString(), vueVersion: version, results };
writeFileSync(new URL('./component-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
