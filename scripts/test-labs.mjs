import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { assetGroups, browserEntries, chapterSlugs, labAssets, projectRoot, resolveSiteOptions } from './lab-assets.mjs';
import { prepareLabs } from './prepare-labs.mjs';
import { buildSite } from './build-site.mjs';
import { previewSite } from './preview-site.mjs';

const evidenceRoot = path.join(projectRoot, 'artifacts/vuepress-integration/B');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await fs.mkdir(evidenceRoot, { recursive: true });
async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(evidenceRoot, '.test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function write(filename, value) { await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, value); }
async function close(server) { await new Promise(resolve => server.close(resolve)); }

test('explicit manifest covers 26 HTML entries, 22 bundles, direct scripts, model shards and linked assets', async () => {
  assert.equal(assetGroups.experiments.length, 26);
  assert.equal(browserEntries.length, 22);
  assert.equal(new Set(labAssets.map(asset => asset.destination)).size, labAssets.length);
  const files = new Set(labAssets.map(asset => asset.source));
  for (const asset of labAssets) {
    assert.equal((await fs.stat(path.join(projectRoot, asset.source))).isFile(), true, asset.source);
    assert.doesNotMatch(asset.source, /(?:\.gz$|\.log$|node_modules\/|__tests__\/)/);
  }
  const actualEntries = [];
  for (const slug of chapterSlugs) {
    if (await fs.access(path.join(projectRoot, slug, 'browser.js')).then(() => true, () => false)) actualEntries.push(`${slug}/browser.js`);
  }
  assert.deepEqual(browserEntries, actualEntries);
  for (const asset of labAssets.filter(asset => asset.source.endsWith('.html'))) {
    const html = await fs.readFile(path.join(projectRoot, asset.source), 'utf8');
    const page = new URL(`/ocr/labs/${asset.source}`, 'http://example.test');
    assert.match(html, /data-course-doc="\d{2}-/);
    assert.match(html, /data-course-catalog/);
    for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
      const target = new URL(match[1].replaceAll('&amp;', '&'), page);
      if (target.origin === page.origin) assert.ok(target.pathname.startsWith('/ocr/'), `${asset.source} → ${match[1]} escapes SITE_BASE`);
      if (target.origin !== page.origin || !target.pathname.startsWith('/ocr/labs/')) continue;
      assert.ok(!target.pathname.endsWith('/'), `${asset.source} → ${match[1]} needs index.html for the VuePress public directory`);
      const resource = decodeURIComponent(target.pathname.slice('/ocr/labs/'.length)).replace(/\/$/, '/index.html');
      assert.ok(files.has(resource), `${asset.source} → ${match[1]} is not declared`);
    }
  }
  const model = JSON.parse(await fs.readFile(path.join(projectRoot, '17-cnn-classifier/model/model.json'), 'utf8'));
  for (const group of model.weightsManifest) for (const shard of group.paths) assert.ok(files.has(`17-cnn-classifier/model/${shard}`));
});

test('all assembled assets preserve bytes and paths, replacing stale output after validation', async t => {
  const directory = await temporaryDirectory(t);
  const outputDir = path.join(directory, 'labs');
  await write(path.join(outputDir, 'stale.txt'), 'stale');
  const result = await prepareLabs({ outputDir, quiet: true });
  assert.equal(result.files, labAssets.length);
  assert.equal(await fs.access(path.join(outputDir, 'stale.txt')).then(() => true, () => false), false);
  for (const asset of labAssets) {
    const source = await fs.readFile(path.join(projectRoot, asset.source));
    const copied = await fs.readFile(path.join(outputDir, asset.destination));
    assert.equal(hash(copied), hash(source), asset.source);
  }
});

test('missing resources fail with file names and preserve the previous successful assembly', async t => {
  const directory = await temporaryDirectory(t);
  const outputDir = path.join(directory, 'labs');
  await write(path.join(outputDir, 'keep.txt'), 'last successful assembly');
  const missing = '17-cnn-classifier/model/absent-weights.bin';
  await assert.rejects(prepareLabs({ outputDir, assets: [{ source: missing, destination: missing }], quiet: true }), error => error.message.includes(missing));
  assert.equal(await fs.readFile(path.join(outputDir, 'keep.txt'), 'utf8'), 'last successful assembly');
  const cli = await new Promise((resolve, reject) => {
    const source = `import { prepareLabs } from ${JSON.stringify(pathToFileURL(path.join(projectRoot, 'scripts/prepare-labs.mjs')).href)}; await prepareLabs(${JSON.stringify({ root: directory, outputDir, quiet: true })});`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', reject);
    child.once('exit', code => resolve({ code, stderr }));
  });
  assert.notEqual(cli.code, 0);
  assert.match(cli.stderr, /17-cnn-classifier\/model\/weights\.bin/);
  await assert.rejects(prepareLabs({ outputDir, assets: [{ source: '../package.json', destination: 'package.json' }] }), /路径无效/);
});

test('unified build propagates the lab build exit and does not start assembly or VuePress', async t => {
  const directory = await temporaryDirectory(t);
  await write(path.join(directory, 'scripts/build.js'), 'process.exit(37);');
  await write(path.join(directory, 'node_modules/vuepress/bin/vuepress.js'), "require('node:fs').writeFileSync('unexpected-vuepress-build', 'ran');");
  await assert.rejects(buildSite({ root: directory, base: '/', dest: 'dist' }), error => error.exitCode === 37);
  assert.equal(await fs.access(path.join(directory, 'unexpected-vuepress-build')).then(() => true, () => false), false);
  assert.equal(await fs.access(path.join(directory, '.vuepress/public/labs')).then(() => true, () => false), false);
});

test('unified build stops before VuePress when required model assets are missing', async t => {
  const directory = await temporaryDirectory(t);
  await write(path.join(directory, 'scripts/build.js'), 'process.exit(0);');
  await write(path.join(directory, 'node_modules/vuepress/bin/vuepress.js'), "require('node:fs').writeFileSync('unexpected-vuepress-build', 'ran');");
  await assert.rejects(buildSite({ root: directory, base: '/', dest: 'dist' }), /17-cnn-classifier\/model\/weights\.bin/);
  assert.equal(await fs.access(path.join(directory, 'unexpected-vuepress-build')).then(() => true, () => false), false);
});

for (const base of ['/', '/ocr/']) test(`preview serves only final output under ${base}, with correct redirects and resource bytes`, async t => {
  const directory = await temporaryDirectory(t);
  const port = await freePort();
  await write(path.join(directory, 'dist/index.html'), '<h1>Final output</h1>');
  await write(path.join(directory, 'dist/11-feature-extraction/index.html'), '<h1>Chapter 11</h1>');
  await write(path.join(directory, 'dist/labs/17-cnn-classifier/model/weights.bin'), Buffer.from([0, 255, 4, 7]));
  await write(path.join(directory, 'private-source.txt'), 'must never be served');
  const server = await previewSite({ root: directory, dest: 'dist', base, host: '127.0.0.1', port, quiet: true });
  t.after(() => close(server));
  const origin = `http://127.0.0.1:${port}`;
  assert.match(await (await fetch(origin + base)).text(), /Final output/);
  const redirect = await fetch(origin + base + '11-feature-extraction?from=lab', { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), `${base}11-feature-extraction/?from=lab`);
  const resource = origin + base + 'labs/17-cnn-classifier/model/weights.bin';
  assert.deepEqual(Buffer.from(await (await fetch(resource)).arrayBuffer()), Buffer.from([0, 255, 4, 7]));
  const head = await fetch(resource, { method: 'HEAD' });
  assert.equal(head.headers.get('content-length'), '4');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal((await fetch(origin + base + 'private-source.txt')).status, 404);
  assert.equal((await fetch(origin + base + 'node_modules/vuepress/package.json')).status, 403);
  assert.equal((await fetch(resource, { method: 'POST' })).status, 405);
  if (base !== '/') {
    assert.equal((await fetch(origin + '/labs/17-cnn-classifier/model/weights.bin')).status, 404);
    assert.equal((await fetch(origin + '/ocr', { redirect: 'manual' })).headers.get('location'), '/ocr/');
  }
});

test('site option validation keeps all entry points on the same base/host/port/dest contract', () => {
  const values = resolveSiteOptions({ base: '/ocr/', host: '127.0.0.1', port: 4173, dest: '.vuepress/dist' });
  assert.equal(values.base, '/ocr/');
  assert.equal(values.port, 4173);
  assert.equal(values.dest, path.join(projectRoot, '.vuepress/dist'));
  assert.throws(() => resolveSiteOptions({ port: 'NaN' }), /SITE_PORT/);
  assert.throws(() => resolveSiteOptions({ dest: projectRoot }), /SITE_DEST/);
  assert.throws(() => resolveSiteOptions({ base: '/../' }), /base/);
});

test('training bridge config-only accepts explicit local origins and cannot read datasets or write models', async t => {
  const directory = await temporaryDirectory(t);
  const port = await freePort();
  const require = createRequire(import.meta.url);
  const { main, bridgeSettings } = require('../17-cnn-classifier/train-webgl.js');
  const output = path.join(directory, 'must-not-be-created');
  const allowedOrigin = 'http://127.0.0.1:4273';
  const server = await main(['--config-only', output], { OCR_TRAIN_PORT: String(port), OCR_TRAIN_ORIGINS: allowedOrigin, SITE_BASE: '/ocr/' });
  t.after(() => close(server));
  const origin = `http://127.0.0.1:${port}`;
  const configResponse = await fetch(origin + '/config', { headers: { Origin: allowedOrigin } });
  assert.equal(configResponse.status, 200);
  assert.equal(configResponse.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.equal(configResponse.headers.get('x-ocr-bridge-mode'), 'config-only');
  assert.equal(configResponse.headers.get('access-control-expose-headers'), 'X-OCR-Bridge-Mode');
  const config = await configResponse.json();
  assert.equal(config.seed, 1701);
  assert.equal(config.trainSize, 55000);
  assert.equal(config.dropoutSeedPolicy, 'resample');
  assert.equal((await fetch(origin + '/config', { headers: { Origin: 'https://example.org' } })).status, 403);
  assert.equal((await fetch(origin + '/config', { headers: { Origin: allowedOrigin + '/ocr/' } })).status, 403);
  assert.equal((await fetch(origin + '/validation', { headers: { Origin: allowedOrigin } })).status, 405);
  assert.equal((await fetch(origin + '/checkpoint', { method: 'POST', headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' }, body: '{}' })).status, 405);
  assert.equal((await fetch(origin + '/config', { method: 'OPTIONS', headers: { Origin: allowedOrigin } })).status, 204);
  assert.equal(await fs.access(output).then(() => true, () => false), false);
  assert.throws(() => bridgeSettings({ OCR_TRAIN_ORIGINS: 'http://example.org' }), /仅接受/);
  assert.throws(() => bridgeSettings({ OCR_TRAIN_ORIGINS: allowedOrigin + '/ocr/' }), /仅接受/);
});

test('all protected model and historical evaluation artifacts retain baseline hashes', async () => {
  const baseline = JSON.parse(await fs.readFile(path.join(projectRoot, 'artifacts/vuepress-integration/baseline/protected-artifacts.json'), 'utf8'));
  for (const [file, expected] of Object.entries(baseline)) {
    const bytes = await fs.readFile(path.join(projectRoot, file));
    assert.equal(bytes.length, expected.bytes, file);
    assert.equal(hash(bytes), expected.sha256, file);
  }
});
