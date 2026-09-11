/** Actual browser controls for saved-model inference and synthetic evaluation.
 * Uses only a dedicated vuepress-d* agent-browser session; restores its record key.
 * Never calls model training or writes historical model/report files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHarness, optionsFromArgs } from './verify-course-site.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const storageKey = 'ocr-photo-evaluation-v1';
function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
    row = next;
  }
  return row[b.length];
}

export async function verifyFlows(options = optionsFromArgs()) {
  if (!options.session.startsWith('vuepress-d')) throw new Error('Use a dedicated vuepress-d* session, never a user profile');
  const h = createHarness(options, 'flows');
  const { ab, evaluate, check, save, snapshot, screenshot } = h;
  const route = relative => new URL(relative, options.url).href;
  const readRecords = () => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || '[]')`);
  const model = JSON.parse(fs.readFileSync(path.join(root, '17-cnn-classifier/model/model.json'), 'utf8'));
  const expectedModelId = model.userDefinedMetadata.modelId;
  const truth = JSON.parse(fs.readFileSync(path.join(root, '26-validation/development-manifest.json'), 'utf8')).rows.find(x => x.path === 'fixtures/development-line.png').truth;
  const results = { timestamp: new Date().toISOString(), url: options.url.href, dataKind: 'synthetic-mnist; not real photos', expectedModelId, truth };
  let backup;
  try {
    ab('set', 'viewport', '1440', '1000');
    ab('open', route('labs/17-cnn-classifier/index.html')); ab('wait', '#classify');
    ab('errors', '--clear'); ab('console', '--clear');
    snapshot('17-initial');
    ab('click', '#sample'); ab('wait', '--fn', `document.querySelector('#output').textContent.includes('真值')`);
    const sample = evaluate(`document.querySelector('#output').textContent`);
    ab('click', '#classify'); ab('wait', '--fn', `!document.querySelector('#classify').disabled && document.querySelector('#output').textContent.includes('prediction')`);
    const inference = evaluate(`JSON.parse(document.querySelector('#output').textContent)`);
    check('17 loads the exact saved model and performs inference', inference.modelId === expectedModelId && /^[0-9]$/.test(String(inference.prediction)) && inference.blank === false, { sample, inference });
    check('17 repeated inference tensor count stable', inference.tensorsBefore25Predictions === inference.tensorsAfter25Predictions, inference);
    check('17 needs no training bridge to infer', !evaluate(`performance.getEntriesByType('resource').some(x=>/localhost:3000|127\\.0\\.0\\.1:3000|\\/batch|\\/save-model/.test(x.name))`), null);
    results.inference = { sample, ...inference }; snapshot('17-inference'); screenshot('17-inference');
    ab('click', '#clear'); ab('click', '#classify');
    ab('wait', '--fn', `!document.querySelector('#classify').disabled && document.querySelector('#output').textContent.includes('blank')`);
    const blank = evaluate(`JSON.parse(document.querySelector('#output').textContent)`);
    check('17 blank canvas explicitly refused', blank.blank === true && blank.prediction === null, blank); results.blank = blank;

    ab('open', route('labs/25-ocr-engine/index.html')); ab('wait', '#modelStatus');
    backup = evaluate(`localStorage.getItem(${JSON.stringify(storageKey)})`);
    save('session-record-backup.json', { key: storageKey, value: backup });
    evaluate(`localStorage.removeItem(${JSON.stringify(storageKey)})`);
    ab('fill', '#experiment', `D-${options.label}-synthetic-${Date.now()}`); ab('press', 'Tab');
    ab('click', '#sample'); ab('wait', '--fn', `!document.querySelector('#recognize').disabled`);
    const loaded = evaluate(`({source:document.querySelector('#sourceLabel').textContent,model:document.querySelector('#modelStatus').textContent})`);
    check('25 built-in input explicitly identified as synthetic', /合成|拼接样例.*非实拍/.test(loaded.source), loaded);
    ab('click', '#recognize');
    ab('wait', '--fn', `!document.querySelector('#recognize').disabled && !document.querySelector('#save').disabled`);
    const firstPrediction = evaluate(`document.querySelector('#result').textContent`);
    ab('fill', '#truth', truth); ab('click', '#compare');
    const comparison = evaluate(`document.querySelector('#comparison').textContent`);
    ab('click', '#save');
    const firstRecords = readRecords();
    const first = firstRecords[0];
    check('25 saves first prediction and leading-zero string label', firstRecords.length === 1 && first?.prediction === firstPrediction && first.truth === truth && typeof first.truth === 'string' && first.truth.startsWith('00'), firstRecords);
    check('25 records source, exact saved model and pipeline/config', first?.sampleKind === 'synthetic-mnist' && first.modelId === expectedModelId && /^[a-f0-9]{12}$/.test(first.pipelineId) && typeof first.config?.pipelineVersion === 'string', first);
    results.first = first; results.comparison = comparison; results.loaded = loaded; snapshot('25-first-saved'); screenshot('25-first-saved'); save('first-record.json', first);
    // Re-run actual controls with a changed pipeline; the saved first record must survive.
    ab('click', 'details > summary'); ab('uncheck', '#autoDeskew'); ab('fill', '#angle', '8'); ab('press', 'Tab'); ab('click', '#recognize');
    ab('wait', '--fn', `!document.querySelector('#recognize').disabled && !document.querySelector('#save').disabled`);
    const retryPrediction = evaluate(`document.querySelector('#result').textContent`);
    ab('click', '#save');
    const duplicateStatus = evaluate(`document.querySelector('#status').textContent`);
    check('25 changed-parameter retry cannot overwrite first prediction', JSON.stringify(readRecords()) === JSON.stringify(firstRecords) && /本轮已记录/.test(duplicateStatus), { retryPrediction, duplicateStatus });
    results.retry = { retryPrediction, duplicateStatus }; snapshot('25-retry-preserves-first');
    ab('click', 'a[data-course-lab="26-validation"]'); ab('wait', '#group');
    check('25 to 26 stays on same origin and base', evaluate('location.href') === route('labs/26-validation/index.html'), evaluate('location.href'));
    const score = evaluate(`({cer:document.querySelector('#cer').textContent,fraction:document.querySelector('#cerFraction').textContent,exact:document.querySelector('#exact').textContent,count:document.querySelector('#count').textContent,group:document.querySelector('#group').textContent,info:document.querySelector('#groupInfo').textContent,prediction:document.querySelector('#rows tr td:nth-child(2)')?.textContent,truth:document.querySelector('#rows tr input')?.value})`);
    const edits = editDistance(truth, first.prediction);
    check('26 CER agrees with independent Levenshtein calculation', score.cer === `${(edits / truth.length * 100).toFixed(1)}%` && score.count === '1' && score.prediction === first.prediction && score.truth === truth, { score, edits, truthLength: truth.length });
    check('26 group preserves synthetic source, model and pipeline', /合成样例/.test(score.group) && score.group.includes(first.modelId) && score.group.includes(first.pipelineId), score);
    results.score = { ...score, independentEdits: edits }; snapshot('26-score'); screenshot('26-score');
    ab('click', '#rows tr:first-child button:nth-of-type(2)');
    check('26 alignment actually opens', evaluate(`document.querySelectorAll('#alignment .op').length > 0`), evaluate(`document.querySelector('#alignment').textContent`));
    const exportPath = path.join(options.out, 'evaluation-export.json');
    ab('download', '#export', exportPath);
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    check('26 JSON export preserves exact first record', exported.schemaVersion === 1 && isDeepStrictEqual(exported.records, firstRecords), exported);
    // Simulate another empty context through the original supported import path.
    evaluate(`localStorage.removeItem(${JSON.stringify(storageKey)})`); ab('reload'); ab('wait', '#import');
    check('26 empty record state after context reset', evaluate(`document.querySelector('#empty').hidden === false`), null);
    ab('upload', '#import', exportPath); ab('wait', '--fn', `document.querySelector('#status').textContent.includes('已合并')`);
    check('26 JSON import restores source/model/pipeline/leading zeros', JSON.stringify(readRecords()) === JSON.stringify(firstRecords), readRecords());
    ab('upload', '#import', exportPath); ab('wait', '--fn', `document.querySelector('#import').value === ''`);
    check('26 importing same file twice does not duplicate records', readRecords().length === 1, readRecords());
    const conflicting = { ...exported, records: [{ ...first, prediction: first.prediction === '9' ? '8' : '9' }] };
    const conflictPath = path.join(options.out, 'evaluation-conflict.json'); save('evaluation-conflict.json', conflicting);
    ab('upload', '#import', conflictPath); ab('wait', '--fn', `document.querySelector('#status').textContent.includes('冲突')`);
    check('26 conflicting import cannot overwrite first prediction', JSON.stringify(readRecords()) === JSON.stringify(firstRecords), evaluate(`document.querySelector('#status').textContent`));
    const unknownRecord = { ...first, id: `${first.id}-unknown`, imageId: `${first.imageId}-unknown`, experimentId: `${first.experimentId}-unknown` };
    delete unknownRecord.sampleKind;
    const unknownPath = path.join(options.out, 'evaluation-unknown-source.json'); save('evaluation-unknown-source.json', { schemaVersion: 1, records: [unknownRecord] });
    ab('upload', '#import', unknownPath); ab('wait', '--fn', `document.querySelector('#status').textContent.includes('已合并')`);
    check('26 missing provenance remains unknown, never real-photo', evaluate(`document.querySelector('#group').textContent.includes('来源未标注')`) && readRecords().find(x => x.id === unknownRecord.id).sampleKind == null, evaluate(`document.querySelector('#group').textContent`));
    // Re-annotate an existing row through the actual UI, keeping original prediction metadata.
    ab('select', '#group', '0'); ab('fill', '#rows tr:first-child td:nth-child(3) input', truth); ab('click', '#rows tr:first-child button:first-of-type');
    const annotated = readRecords().find(x => x.id === first.id);
    check('26 annotation saves string truth without changing original prediction metadata', annotated.truth === truth && ['prediction', 'sampleKind', 'modelId', 'pipelineId', 'createdAt'].every(k => annotated[k] === first[k]), annotated);
    results.imported = readRecords(); snapshot('26-imported'); screenshot('26-imported');
    const errors = ab('errors'), consoleLog = ab('console'); save('flow-browser-errors.json', errors); save('flow-browser-console.json', consoleLog);
    check('17/25/26 no uncaught browser runtime errors', !(errors.errors || []).length, errors);
    check('17/25/26 no browser console errors', !(consoleLog.messages || []).some(x => x.type === 'error'), (consoleLog.messages || []).filter(x => x.type === 'error'));
  } finally {
    if (backup !== undefined) evaluate(backup == null ? `localStorage.removeItem(${JSON.stringify(storageKey)})` : `localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(backup)})`);
    results.checks = h.checks; results.passed = h.checks.filter(x => x.pass).length; results.failed = h.checks.filter(x => !x.pass).length;
    save('flow-results.json', results);
  }
  console.log(JSON.stringify({ url: options.url.href, passed: results.passed, failed: results.failed, output: options.out }));
  if (results.failed) process.exitCode = 1;
  return results;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyFlows();
