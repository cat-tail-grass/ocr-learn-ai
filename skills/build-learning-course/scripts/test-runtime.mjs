import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeCourse } from './init-course.mjs';
import { validateConfig } from '../assets/course-site/scripts/course-config.mjs';
import { checkCourse } from '../assets/course-site/scripts/check-course.mjs';
import { prepareLabs } from '../assets/course-site/scripts/prepare-labs.mjs';
import { createPreviewServer } from '../assets/course-site/scripts/site.mjs';

const plan = () => ({
  schemaVersion: 1, title: '变化率', description: '用小例子理解变化', audience: '会代数的学习者', outcome: '解释并计算变化率',
  terms: ['平均变化率', 'f(x)'], calibration: { lesson: '01-change', status: 'pending', feedback: '' },
  stages: [{ title: '变化', lessons: [
    { slug: '01-change', title: '变化的速度', prerequisites: [], status: 'planned', web: true, node: true },
    { slug: '02-limit', title: '更小的变化', prerequisites: ['01-change'], status: 'planned', web: false, node: false },
  ] }],
});

function fixture(t, modify = () => {}) {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'learning-skill-test-'));
  t.after(() => rmSync(sandbox, { recursive: true, force: true }));
  const config = plan(); modify(config);
  const configFile = path.join(sandbox, 'plan.json');
  writeFileSync(configFile, JSON.stringify(config));
  const root = path.join(sandbox, 'course with spaces');
  initializeCourse(configFile, root);
  return { sandbox, configFile, config, root };
}

function publishSample(root, config, { node = true, web = true, script = 'console.log("输入 2、3；平方差 5；区间长 1；平均变化率 5");' } = {}) {
  const lesson = config.stages[0].lessons[0];
  Object.assign(lesson, { status: 'draft', node, web });
  const dir = path.join(root, lesson.slug); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'README.md'), '# 变化的速度\n\n平方值从4变成9；区间长1，平均变化率为5。\n');
  if (web) writeFileSync(path.join(dir, 'index.html'), '<!doctype html><h1>变化率实验</h1>');
  if (node) writeFileSync(path.join(dir, 'index.js'), script);
  writeFileSync(path.join(root, 'course.json'), JSON.stringify(config));
  return dir;
}

test('初始化保留隐藏站点文件，路径含空格可用，未生成章不会伪造讲义', t => {
  const { root } = fixture(t);
  assert.ok(existsSync(path.join(root, '.vuepress/config.mjs')));
  assert.ok(existsSync(path.join(root, '.gitignore')));
  assert.equal(existsSync(path.join(root, '01-change/README.md')), false);
  assert.equal(checkCourse(root).failures.length, 0);
  assert.match(readFileSync(path.join(root, 'PROGRESS.md'), 'utf8'), /未评估/);
});

test('拒绝覆盖已有目录，保留已有内容', t => {
  const { root, configFile } = fixture(t);
  const before = readFileSync(path.join(root, 'course.json'), 'utf8');
  assert.throws(() => initializeCourse(configFile, root), /不是空目录/);
  assert.equal(readFileSync(path.join(root, 'course.json'), 'utf8'), before);
});

test('经符号链接启动的 CLI 真正创建课程并执行检查，不会静默退出', t => {
  const { sandbox, configFile } = fixture(t);
  const alias = path.join(sandbox, 'skill-alias');
  symlinkSync(fileURLToPath(new URL('../', import.meta.url)), alias, 'dir');
  const target = path.join(sandbox, 'aliased-course');
  const creation = spawnSync(process.execPath, [path.join(alias, 'scripts/init-course.mjs'), '--plan', configFile, '--out', target], { encoding: 'utf8' });
  assert.equal(creation.status, 0, creation.stderr);
  assert.ok(existsSync(path.join(target, 'course.json')), creation.stdout);
  const courseAlias = path.join(sandbox, 'course-alias'); symlinkSync(target, courseAlias, 'dir');
  const check = spawnSync(process.execPath, [path.join(courseAlias, 'scripts/check-course.mjs')], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.ok(existsSync(path.join(target, '.course-checks/report.json')), check.stdout);
  const invalidMode = spawnSync(process.execPath, [path.join(courseAlias, 'scripts/site.mjs'), 'invalid'], { encoding: 'utf8' });
  assert.equal(invalidMode.status, 1);
  assert.match(invalidMode.stderr, /用法/);
});

test('拒绝未知、逆序前置关系和重复编号', () => {
  const forward = plan(); forward.stages[0].lessons[0].prerequisites = ['02-limit'];
  assert.throws(() => validateConfig(forward), /不.*或尚在其后/);
  const duplicate = plan(); duplicate.stages[0].lessons[1].slug = '01-other';
  assert.throws(() => validateConfig(duplicate), /连续排列/);
  const invalid = plan(); invalid.stages[0].lessons[0].slug = '../escape';
  assert.throws(() => validateConfig(invalid), /无效/);
});

test('无 Node 的学科无需脚本，执行开关不会伪造运行记录', t => {
  const { root, config } = fixture(t);
  publishSample(root, config, { node: false });
  const report = checkCourse(root, { execute: true });
  assert.deepEqual(report.failures, []);
  assert.equal(report.lessons[0].node, 'not-applicable');
  assert.equal(report.lessons[0].browser, 'requires-browser-review');
});

test('结构检查不运行代码；显式运行能捕获真实失败', t => {
  const { root, config } = fixture(t);
  publishSample(root, config, { script: 'import assert from "node:assert/strict"; assert.equal(2 + 2, 5);' });
  assert.equal(checkCourse(root).lessons[0].node, 'not-run');
  const report = checkCourse(root, { execute: true });
  assert.equal(report.lessons[0].node, 'failed');
  assert.ok(report.failures.length > 0);
  assert.match(report.lessons[0].output, /AssertionError/);
});

test('循环实验超时后被终止并报告失败', t => {
  const { root, config } = fixture(t);
  publishSample(root, config, { script: 'while (true) {}' });
  const report = checkCourse(root, { execute: true, timeout: 80 });
  assert.equal(report.lessons[0].node, 'failed');
  assert.match(report.lessons[0].error, /ETIMEDOUT/);
});

test('断链会失败；代码块中的演示路径不当成文档链接', t => {
  const { root, config } = fixture(t);
  const dir = publishSample(root, config);
  writeFileSync(path.join(dir, 'README.md'), '# 变化\n\n[缺失文件](missing.csv)\n\n```md\n[演示](not-real.md)\n```\n');
  const report = checkCourse(root);
  assert.equal(report.failures.length, 1);
  assert.match(report.failures[0], /missing.csv/);
});

test('verified 状态需要章级审查记录，机器仍明确不证明教学质量', t => {
  const { root, config } = fixture(t);
  publishSample(root, config);
  config.stages[0].lessons[0].status = 'verified';
  writeFileSync(path.join(root, 'course.json'), JSON.stringify(config));
  assert.match(checkCourse(root).failures.join(''), /没有 reviews/);
  writeFileSync(path.join(root, 'reviews/01-change.md'), '# 实际内容审查由课程作者补充\n');
  assert.equal(checkCourse(root).lessons[0].teaching, 'requires-review');
});

test('资源准备包含共享模块、实际章节；取消章节后去除旧资源', t => {
  const { root, config } = fixture(t);
  publishSample(root, config);
  writeFileSync(path.join(root, 'shared/rate.js'), 'export const rate = (a, b) => (b * b - a * a) / (b - a);');
  const output = prepareLabs(root);
  assert.ok(existsSync(path.join(output, '01-change/index.html')));
  assert.ok(existsSync(path.join(output, 'shared/rate.js')));
  assert.equal(existsSync(path.join(output, '02-limit')), false);
  config.stages[0].lessons[0].status = 'planned';
  writeFileSync(path.join(root, 'course.json'), JSON.stringify(config));
  prepareLabs(root);
  assert.equal(existsSync(path.join(output, '01-change')), false);
});

test('缺少已声明入口时失败；不把符号链接带出课程', t => {
  const { root, config, sandbox } = fixture(t);
  const dir = publishSample(root, config);
  rmSync(path.join(dir, 'index.html'));
  assert.throws(() => prepareLabs(root), /ENOENT/);
  writeFileSync(path.join(dir, 'index.html'), '<h1>恢复</h1>');
  const outside = path.join(sandbox, 'outside.txt'); writeFileSync(outside, 'outside');
  symlinkSync(outside, path.join(dir, 'outside.txt'));
  assert.throws(() => prepareLabs(root), /项目之外/);
});

test('最终静态预览支持子目录、ES模块；缺页真实返回404', async t => {
  const { root, config } = fixture(t);
  publishSample(root, config);
  prepareLabs(root);
  const publicRoot = path.join(root, '.vuepress/public');
  writeFileSync(path.join(publicRoot, 'index.html'), '<h1>课程首页</h1>');
  const server = createPreviewServer(publicRoot, '/course/');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/course/')).status, 200);
  const script = await fetch(base + '/course/labs/shared/course-nav.js');
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(base + '/course/missing-page/')).status, 404);
  assert.equal((await fetch(base + '/labs/01-change/index.html')).status, 404);
});
