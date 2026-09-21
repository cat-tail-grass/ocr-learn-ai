import {expression,choiceQuestions,gapQuestions,checkGap,rubric} from '../shared/english-practice.js';
const $=id=>document.getElementById(id);
const kindLabels={correct:'符合要求',form:'形式检查',meaning:'含义检查',empty:'尚未作答',review:'需要对照'};
function text(id,value){$(id).textContent=value;}
function renderExpression(){
  const result=expression($('subject').value,$('activity').value,$('lens').value);
  for(const id of ['context','sentence','meaning','simple','continuous','contrast','warning']) text(id,result[id]);
  $('steps').replaceChildren(...result.steps.map(step=>{const li=document.createElement('li');li.textContent=step;return li;}));
  text('status','已按当前人物、活动和意图更新。');
}
for(const id of ['subject','activity','lens']) $(id).addEventListener('change',renderExpression);
function fillSelect(id,items,label){
  $(id).replaceChildren(...items.map((item,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=label(item,index);return option;}));
}
fillSelect('question',choiceQuestions,(q)=>q.prompt.split('。')[0]);
fillSelect('gap-question',gapQuestions,(q)=>q.label);
function renderChoice(){
  const q=choiceQuestions[Number($('question').value)];text('question-prompt',q.prompt);
  $('options').replaceChildren(...q.options.map((option,index)=>{
    const label=document.createElement('label');label.className='option';
    const input=document.createElement('input');input.type='radio';input.name='choice';input.value=String(index);
    const span=document.createElement('span');span.textContent=option.text;span.className='answer';
    input.addEventListener('change',()=>text('choice-feedback','选项已改变；请重新核对。'));
    label.append(input,span);return label;
  }));text('choice-feedback','先选一句，再核对。');
}
$('question').addEventListener('change',renderChoice);
$('check-choice').addEventListener('click',()=>{
  const selected=document.querySelector('input[name="choice"]:checked');
  if(!selected){text('choice-feedback','请先选择一个选项，再核对。');return;}
  const result=choiceQuestions[Number($('question').value)].options[Number(selected.value)];
  text('choice-feedback',`${kindLabels[result.kind]}：${result.feedback}`);
});
$('next-choice').addEventListener('click',()=>{$('question').value=String((Number($('question').value)+1)%choiceQuestions.length);renderChoice();});
function renderGap(){
  const q=gapQuestions[Number($('gap-question').value)];text('gap-prompt',q.prompt);text('gap-instruction',q.instruction);
  $('gap-answer').value='';text('gap-feedback','先自己填写，再核对。');
}
$('gap-question').addEventListener('change',renderGap);
$('gap-answer').addEventListener('input',()=>text('gap-feedback','答案已改变；请重新核对。'));
$('check-gap').addEventListener('click',()=>{
  const q=gapQuestions[Number($('gap-question').value)],result=checkGap(q.id,$('gap-answer').value);
  text('gap-feedback',`${kindLabels[result.kind]}：${result.feedback}`);
});
$('show-gap').addEventListener('click',()=>{
  const q=gapQuestions[Number($('gap-question').value)];text('gap-feedback',`参考：${q.reference} 依据：${q.reason} 查看参考不记为独立完成。`);
});
$('rubric').replaceChildren(...rubric.map(item=>{
  const group=document.createElement('div');group.className='rubric-item';
  const label=document.createElement('label');label.htmlFor=`score-${item.id}`;label.textContent=`${item.title} · 暂定自评分`;
  const select=document.createElement('select');select.id=`score-${item.id}`;
  const unset=document.createElement('option');unset.value='';unset.textContent='尚未自评';select.append(unset);
  [2,1,0].forEach(score=>{const option=document.createElement('option');option.value=String(score);option.textContent=`${score}分 · ${item.levels[score]}`;select.append(option);});
  const evidenceLabel=document.createElement('label');evidenceLabel.htmlFor=`evidence-${item.id}`;evidenceLabel.textContent=`${item.title} · 我的依据`;
  const evidence=document.createElement('textarea');evidence.id=`evidence-${item.id}`;evidence.placeholder='指出一句表达，或写需要修订的地方。';
  group.append(label,select,evidenceLabel,evidence);return group;
}));
function freeState(){return {writing:$('free-writing').value.trim(),revision:$('free-revision').value.trim(),rows:rubric.map(item=>({title:item.title,score:$(`score-${item.id}`).value,evidence:$(`evidence-${item.id}`).value.trim()}))};}
function clearStaleReview(){text('free-feedback','内容或自评已改变，请重新整理；修改不会自动更新先前结论。');}
for(const control of [$('free-writing'),$('free-revision'),...$('rubric').querySelectorAll('textarea,select')]) control.addEventListener(control.tagName==='SELECT'?'change':'input',clearStaleReview);
$('review-free').addEventListener('click',()=>{
  const state=freeState();
  if(!state.writing){text('free-feedback','请先写第一稿；暂不生成自评总结。');return;}
  if(!state.revision || state.rows.some(row=>row.score==='' || !row.evidence)){text('free-feedback','请补上修订与中文解释，并为四项选择分数、填写依据。网页不会替你猜分。');return;}
  const total=state.rows.reduce((sum,row)=>sum+Number(row.score),0),needsReview=state.rows.filter(row=>Number(row.score)<1).map(row=>row.title);
  text('free-feedback',`你的暂定自评：${total}/8。${needsReview.length?`先回看：${needsReview.join('、')}。`:total<6?'建议再选一处改进后重评。':'按你提供的自评，可尝试一个新情境来巩固。'} 这是你填写的评价，网页未判断语言正确性，也不更新学习掌握状态。`);
});
$('download-free').addEventListener('click',()=>{
  const state=freeState();if(!state.writing){text('free-feedback','先写一点自己的表达，再下载。');return;}
  const content=['日常英语第1章 · 我的表达与暂定自评','第一稿与情境',state.writing,'修订与中文解释',state.revision||'尚未填写',...state.rows.map(row=>`${row.title}：${row.score===''?'未评':row.score+'/2'}\n依据：${row.evidence||'尚未填写'}`),'本文件记录使用者自评，不是自动语言评分。'].join('\n\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='my-daily-english.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  text('free-feedback','已发起下载，保留第一稿和修订依据；网页不上传内容。');
});
$('clear-free').addEventListener('click',()=>{
  $('free-writing').value='';$('free-revision').value='';for(const item of rubric){$(`score-${item.id}`).value='';$(`evidence-${item.id}`).value='';}text('free-feedback','自由表达和自评已清空，可以写一个新情境。');
});
$('reset').addEventListener('click',()=>{
  $('subject').value='mei';$('activity').value='cook';$('lens').value='routine';$('question').value='0';$('gap-question').value='0';renderExpression();renderChoice();renderGap();text('status','已恢复 Mei 做晚饭的初始示例和固定题；自由表达保留。');
});
renderExpression();renderChoice();renderGap();
