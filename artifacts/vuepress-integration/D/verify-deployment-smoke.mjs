// Independent deployment/base smoke, supplementing the full root body audit.
import { createHarness } from '../../../scripts/verify-course-site.mjs';
import { labAssets, chapterSlugs } from '../../../scripts/lab-assets.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const url = new URL(process.argv[2]);
const label = process.argv[3] || 'dev-ocr';
const out = fileURLToPath(new URL(`./${label}/`, import.meta.url));
const h = createHarness({ url, label, out, session: `vuepress-d-${label}` }, 'smoke');
const { ab, evaluate, check, save, screenshot } = h;
const route = relative => new URL(relative, url).href;
const pages = [], resources = new Set();
ab('set','viewport','1440','1000');
ab('open',url.href); ab('wait','#course-catalog');
ab('errors','--clear'); ab('console','--clear');
check('base homepage has eight stages and 26 chapters',evaluate(`document.querySelectorAll('.course-stage').length===8&&document.querySelectorAll('.course-chapter-link').length===26`));
for(const relative of ['04-binarization/','11-feature-extraction/','17-cnn-classifier/','25-ocr-engine/','labs/11-feature-extraction/index.html','labs/17-cnn-classifier/index.html','labs/20-crnn/index.html','labs/25-ocr-engine/index.html','labs/26-validation/index.html']){
  ab('open',route(relative)); ab('wait','--load','networkidle'); ab('reload'); ab('wait','--load','networkidle');
  const page=evaluate(`({url:location.href,h1:document.querySelector('h1')?.textContent,command:document.querySelector('.course-node-command code')?.textContent,lab:document.querySelector('.course-lab-button')?.href,links:[...document.querySelectorAll('a[href]')].map(x=>x.href).filter(x=>x.startsWith(location.origin)),resources:performance.getEntriesByType('resource').map(x=>({url:x.name,status:x.responseStatus})),text:document.body.innerText.slice(0,400),width:document.documentElement.scrollWidth,viewport:innerWidth,overlay:!!document.querySelector('vite-error-overlay')})`);
  check(`${relative}: direct refresh loads actual page`,page.url===route(relative)&&!!page.h1&&page.text.length>30&&!page.overlay,{url:page.url,h1:page.h1});
  check(`${relative}: every internal link keeps base`,page.links.every(x=>new URL(x).pathname.startsWith(url.pathname)),page.links.filter(x=>!new URL(x).pathname.startsWith(url.pathname)));
  check(`${relative}: runtime resources keep base and succeed`,page.resources.every(x=>!x.url.startsWith(url.origin)||(new URL(x.url).pathname.startsWith(url.pathname)&&x.status<400)),page.resources.filter(x=>x.status>=400));
  if(!relative.startsWith('labs/'))check(`${relative}: experiment route uses base`,page.lab===route(`labs/${relative}index.html`),page.lab);
  page.resources.forEach(x=>{if(x.url.startsWith(url.origin))resources.add(x.url)});pages.push({relative,...page});
}
ab('open',route('25-ocr-engine/')); ab('wait','#content'); ab('set','viewport','390','844');
check('subpath mobile course fits viewport',evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));screenshot('25-mobile');
for(const relative of ['',...chapterSlugs.map(x=>`${x}/`),...chapterSlugs.map(x=>`labs/${x}/index.html`),...labAssets.map(x=>`labs/${x.destination}`)])resources.add(route(relative));
const pending=[...resources],http=[];
await Promise.all(Array.from({length:8},async()=>{while(pending.length){const resource=pending.shift();try{const response=await fetch(resource,{method:'HEAD',signal:AbortSignal.timeout(20000)});http.push({url:resource,status:response.status,type:response.headers.get('content-type')})}catch(error){http.push({url:resource,error:error.message})}}}));
check('26 documents, 26 labs, 78 manifest assets and observed modules return HTTP success',http.every(x=>x.status>=200&&x.status<400),http.filter(x=>!(x.status>=200&&x.status<400)));
const errors=ab('errors'),consoleLog=ab('console');
check('no browser runtime or console errors',!(errors.errors||[]).length&&!(consoleLog.messages||[]).some(x=>x.type==='error'),{errors:errors.errors,consoleErrors:(consoleLog.messages||[]).filter(x=>x.type==='error')});
save('smoke-pages.json',pages);save('smoke-http.json',http);save('smoke-errors.json',errors);save('smoke-console.json',consoleLog);
save('smoke-results.json',{timestamp:new Date().toISOString(),url:url.href,checks:h.checks,passed:h.checks.filter(x=>x.pass).length,failed:h.checks.filter(x=>!x.pass).length,httpCount:http.length});
console.log(JSON.stringify({passed:h.checks.filter(x=>x.pass).length,failed:h.checks.filter(x=>!x.pass).length,httpCount:http.length,out}));
if(h.checks.some(x=>!x.pass))process.exitCode=1;
