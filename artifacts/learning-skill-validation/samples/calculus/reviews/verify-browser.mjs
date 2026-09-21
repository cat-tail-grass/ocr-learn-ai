import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '/tmp/build-learning-course-forward-20260917/calculus-browser-tools/node_modules/playwright/index.mjs';

const root=path.resolve('.');
const base='http://127.0.0.1:4317';
const lesson='/03-derivative-at-a-point/';
const results=[];
const errors=[];
const responseFailures=[];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});
context.on('page',page=>{
  page.on('pageerror',error=>errors.push({url:page.url(),message:error.message}));
  page.on('response',r=>{if(r.status()>=400)responseFailures.push({url:r.url(),status:r.status()});});
});
context.setDefaultTimeout(12000);
const page=await context.newPage();
async function check(name,fn){
  try{const evidence=await fn();results.push({name,status:'passed',evidence});}
  catch(error){results.push({name,status:'failed',error:error.message});}
}
async function noOverflow(p){return p.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth}));}
await check('静态首页与完整路线',async()=>{
  const response=await page.goto(base+'/',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  assert.equal(await page.getByText('待准备',{exact:true}).count(),7);
  assert.equal(await page.locator('.course-chapter-list li').count(),8);
  assert.equal(await page.locator('.course-chapter-list a.course-chapter-link').count(),1);
  await page.screenshot({path:'reviews/desktop-home.png',fullPage:true});
  await page.getByRole('link',{name:'课程大纲',exact:true}).click();
  await page.waitForURL('**/OUTLINE.html');
  await page.getByRole('heading',{name:'完整学习路线',exact:true}).waitFor({state:'visible'});
  assert.match(await page.locator('#content').innerText(),/24 小时/);
  const tableRows=await page.locator('#content table').evaluateAll(tables=>tables.map(table=>[...table.rows].map(row=>row.cells.length)));
  assert.ok(tableRows.every(rows=>rows.every(count=>count===4)));
  assert.match(await page.locator('#content').innerText(),/\|h\|\/h/);
  return {chapters:8,available:1,planned:7,outlineTableColumns:tableRows};
});
await check('中文正文搜索及结果导航',async()=>{
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'搜索课程',exact:true}).click();
  const input=page.getByPlaceholder('搜索课程与正文');
  await input.fill('瞬时变化率');
  await page.getByText('03. 从割线到一点的导数',{exact:true}).waitFor({state:'visible',timeout:15000});
  await page.screenshot({path:'reviews/desktop-search.png'});
  await input.press('ArrowDown');
  await input.press('Enter');
  await page.waitForURL('**/03-derivative-at-a-point/**',{timeout:15000});
  assert.ok(!(await input.isVisible()));
  return {query:'瞬时变化率',destination:page.url()};
});
await check('讲义、公式、表格与答案折叠',async()=>{
  await page.goto(base+lesson,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.katex-error').count(),0);
  const formulas=await page.locator('#content .katex').count();
  assert.equal(formulas,9);
  const columns=await page.locator('#content table').evaluateAll(tables=>tables.map(table=>[...table.rows].map(row=>row.cells.length)));
  for(let i=0;i<columns.length;i++)assert.ok(columns[i].every(n=>n===[5,3,4][i]));
  const summary=page.getByText('完成后展开参考答案与判断依据',{exact:true});
  const details=summary.locator('..');
  assert.equal(await details.evaluate(el=>el.open),false);
  await summary.click();
  assert.equal(await details.evaluate(el=>el.open),true);
  assert.equal(await page.getByText('1. 运用与符号。',{exact:true}).isVisible(),true);
  await summary.click();
  assert.equal(await details.evaluate(el=>el.open),false);
  await page.getByRole('heading',{name:'导数：把这个极限变成一点的变化率',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'reviews/desktop-lesson.png'});
  return {renderedMath:formulas,katexErrors:0,tableColumns:columns,answerToggle:'closed → open → closed'};
});
await check('本章目录与阅读位置',async()=>{
  await page.locator('.course-toc-rail').getByRole('link',{name:'自测问题',exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('.course-reading-progress').value)>0);
  const progress=await page.locator('.course-reading-progress').getAttribute('value');
  assert.ok(Number(progress)>0);
  assert.ok(decodeURIComponent(new URL(page.url()).hash).includes('自测问题'));
  assert.equal(await page.locator('a[href="/01-average-rate/"],a[href="/02-limits/"],a[href="/04-derivative-function/"]').count(),0);
  return {progress,anchor:page.url(),plannedChapterLinks:0};
});
let lab;
await check('由讲义进入网页实验并核对默认样例',async()=>{
  const popup=context.waitForEvent('page');
  await page.getByRole('link',{name:'打开第 03 章交互实验（新标签页）',exact:true}).click();
  lab=await popup;await lab.waitForLoadState('networkidle');
  assert.equal(new URL(lab.url()).pathname,'/labs/03-derivative-at-a-point/index.html');
  assert.equal(await lab.locator('#quotient').innerText(),'4.5');
  assert.equal(await lab.locator('#derivative').innerText(),'4');
  assert.match(await lab.locator('#steps').innerText(),/6.25/);
  assert.match(await lab.locator('#steps').innerText(),/2.25/);
  const rows=await lab.locator('#comparison tr').allTextContents();
  assert.equal(rows.length,3);
  assert.deepEqual(await lab.locator('#comparison tr').first().locator('td').allTextContents(),['0.5','3.5','4.5']);
  await lab.screenshot({path:'reviews/desktop-lab.png',fullPage:true});
  return {a:2,h:0.5,valueA:4,valueB:6.25,delta:2.25,quotient:4.5,derivative:4,tableRows:3};
});
await check('实际改变增量、方向、观察点、函数与切线显示',async()=>{
  assert.ok(lab);
  const original=await lab.locator('#graph-description').textContent();
  await lab.locator('#increment').fill('0.1');assert.equal(await lab.locator('#quotient').innerText(),'4.1');
  await lab.locator('#reverse').click();assert.equal(await lab.locator('#quotient').innerText(),'3.9');
  await lab.locator('#shrink').click();assert.equal(await lab.locator('#quotient').innerText(),'3.99');
  await lab.locator('#point').fill('1');await lab.locator('#increment').fill('0.5');
  assert.equal(await lab.locator('#quotient').innerText(),'2.5');assert.equal(await lab.locator('#derivative').innerText(),'2');
  assert.notEqual(await lab.locator('#graph-description').textContent(),original);
  await lab.locator('#function').selectOption('linear');assert.equal(await lab.locator('#quotient').innerText(),'2');
  await lab.locator('#increment').fill('-0.1');assert.equal(await lab.locator('#quotient').innerText(),'2');
  await lab.locator('#show-tangent').uncheck();assert.equal(await lab.locator('#tangent-line').count(),0);
  await lab.locator('#show-tangent').check();assert.equal(await lab.locator('#tangent-line').count(),1);
  return {observedQuotients:[4.1,3.9,3.99,2.5,2,2],derivativeAt1:2,graphDescriptionChanged:true,tangentToggle:'hidden → visible'};
});
await check('尖点边界、零增量、空值、范围错误与恢复',async()=>{
  await lab.locator('#corner').click();assert.equal(await lab.locator('#derivative').innerText(),'该点导数不存在');
  assert.equal(await lab.locator('#tangent-line').count(),0);
  const values=await lab.locator('#comparison tr').evaluateAll(rows=>rows.map(row=>[...row.cells].map(c=>c.textContent)));
  assert.ok(values.every(row=>row[1]==='-1'&&row[2]==='1'));
  await lab.screenshot({path:'reviews/desktop-corner.png'});
  await lab.locator('#increment').fill('0');assert.match(await lab.locator('#status').innerText(),/差商不能除以 0/);
  assert.equal(await lab.locator('#results').isVisible(),false);
  assert.equal(await lab.locator('#comparison-table').isVisible(),false);
  await lab.locator('#reset').click();assert.equal(await lab.locator('#quotient').innerText(),'4.5');
  await lab.locator('#point').fill('');assert.match(await lab.locator('#status').innerText(),/有限数字/);
  await lab.locator('#point').fill('4');assert.match(await lab.locator('#status').innerText(),/−3 到 3/);
  await lab.locator('#point').fill('2');await lab.locator('#increment').fill('3');assert.match(await lab.locator('#status').innerText(),/显示范围/);
  await lab.locator('#increment').fill('0.000001');await lab.locator('#shrink').click();
  assert.equal(await lab.locator('#increment').inputValue(),'0.000001');assert.match(await lab.locator('#status').innerText(),/最小步长/);
  assert.equal(await lab.locator('#comparison tr').count(),1);
  await lab.locator('#reset').click();assert.equal(await lab.locator('#function').inputValue(),'square');
  assert.equal(await lab.locator('#point').inputValue(),'2');assert.equal(await lab.locator('#increment').inputValue(),'0.5');
  assert.equal(await lab.locator('#results').isVisible(),true);assert.equal(await lab.locator('#quotient').innerText(),'4.5');
  return {cornerRows:values,zero:'readable error; old results hidden',emptyAndRange:'rejected',minimumStep:'bounded at 0.000001',reset:'square, a=2, h=0.5, quotient=4.5'};
});
await check('390px 窄屏阅读、目录与真实实验',async()=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+lesson,{waitUntil:'networkidle'});
  const lessonSize=await noOverflow(page);assert.ok(lessonSize.scrollWidth<=391);
  await page.screenshot({path:'reviews/mobile-lesson-top.png'});
  await page.locator('.course-reading-toc-link').click();
  await page.locator('#course-chapter-toc').getByRole('link',{name:'为什么要引入极限',exact:true}).click();
  await page.locator('#content .katex-display').nth(3).scrollIntoViewIfNeeded();
  await page.screenshot({path:'reviews/mobile-lesson-math.png'});
  const mathSize=await noOverflow(page);assert.ok(mathSize.scrollWidth<=391);
  await lab.setViewportSize({width:390,height:844});await lab.reload({waitUntil:'networkidle'});
  const labSize=await noOverflow(lab);assert.ok(labSize.scrollWidth<=391);
  await lab.locator('#increment').fill('0.1');assert.equal(await lab.locator('#quotient').innerText(),'4.1');
  await lab.locator('#reverse').click();assert.equal(await lab.locator('#quotient').innerText(),'3.9');
  await lab.screenshot({path:'reviews/mobile-lab-controls.png'});
  await lab.locator('#results-title').scrollIntoViewIfNeeded();await lab.screenshot({path:'reviews/mobile-lab-results.png'});
  await lab.locator('#reset').click();
  await lab.getByRole('link',{name:'返回本章讲义',exact:true}).click();
  await lab.waitForURL('**/03-derivative-at-a-point/');
  return {lessonSize,mathSize,labSize,mobileQuotients:[4.1,3.9],returnNavigation:lab.url()};
});
await check('最终静态资源与真实 404',async()=>{
  const paths=['/','/OUTLINE.html',lesson,'/labs/03-derivative-at-a-point/index.html','/labs/03-derivative-at-a-point/browser.js','/labs/shared/rate-model.js','/labs/shared/lab.css','/labs/shared/course-nav.js'];
  const responses=[];
  for(const p of paths){const r=await context.request.get(base+p);assert.equal(r.status(),200);responses.push({path:p,status:r.status()});}
  for(const p of ['/01-average-rate/','/not-a-real-course-route/']){const r=await context.request.get(base+p);assert.equal(r.status(),404);responses.push({path:p,status:r.status()});}
  return responses;
});
await check('浏览器运行时异常和资源失败',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(responseFailures,[]);return {pageErrors:0,responseFailures:0};});
const filePaths=['course.json','PROGRESS.md','.vuepress/styles/course.css','03-derivative-at-a-point/README.md','03-derivative-at-a-point/index.html','03-derivative-at-a-point/browser.js','shared/rate-model.js'];
const files=Object.fromEntries(filePaths.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const report={date:new Date().toISOString(),mode:'final static preview',base,browser:await browser.version(),viewports:[{width:1440,height:1000},{width:390,height:844}],files,results,errors,responseFailures,passed:results.every(r=>r.status==='passed')};
fs.writeFileSync('reviews/browser-validation.json',JSON.stringify(report,null,2)+'\n');
for(const result of results)console.log(`${result.status}: ${result.name}${result.error?' — '+result.error:''}`);
console.log(`浏览器验证：${results.filter(r=>r.status==='passed').length}/${results.length} 组通过。`);
await browser.close();
if(!report.passed)process.exitCode=1;
