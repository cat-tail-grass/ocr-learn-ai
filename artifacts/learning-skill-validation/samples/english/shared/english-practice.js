export const subjects = {
  mei: {text:'Mei', be:'is', third:true, meaning:'梅，一个人名，按 she 处理'},
  i: {text:'I', be:'am', third:false, meaning:'我，be 用 am'},
  she: {text:'She', be:'is', third:true, meaning:'她，第三人称单数'},
  they: {text:'They', be:'are', third:false, meaning:'他们/她们，be 用 are'}
};
export const activities = {
  cook: {base:'cook', third:'cooks', ing:'cooking', rest:'dinner', zh:'做晚饭'},
  read: {base:'read', third:'reads', ing:'reading', rest:'a book', zh:'读一本书'},
  work: {base:'work', third:'works', ing:'working', rest:'at home', zh:'在家工作'},
  drink: {base:'drink', third:'drinks', ing:'drinking', rest:'tea', zh:'喝茶'},
  study: {base:'study', third:'studies', ing:'studying', rest:'English', zh:'学英语'},
  know: {base:'know', third:'knows', rest:'the answer', zh:'知道答案', state:true}
};
export function expression(subjectId, activityId, lens) {
  const s=subjects[subjectId], a=activities[activityId];
  if(!s || !a || !['routine','now','period'].includes(lens)) throw new Error('请选择页面提供的人物、活动和意图。');
  const simpleVerb=s.third?a.third:a.base;
  const simple=`${s.text} ${simpleVerb} ${a.rest}.`;
  if(a.state) return {
    sentence:`${s.text} ${simpleVerb} ${a.rest}${lens==='now'?' now':''}.`,
    context:'此人已经掌握答案。你要表达“知道”这个状态；即使强调现在，也不是一个正在做的动作。',
    steps:[`意图：${lens==='now'?'现在知道':lens==='period'?'当前这段时间知道':'说明知道这一状态'}`,`主语：${s.text}；${s.meaning}`,`状态动词 know：使用 ${simpleVerb}，这里不套 be + ing。`],
    meaning:'表达“知道答案”。now 可以出现在句中，但不会把 know 自动变成进行时。',
    simple, continuous:'本例不采用 be + knowing。',
    contrast:'know 的普通“知道”意义通常不用进行时。词义和语境要一起判断。',
    warning:'边界提醒：这里没有生成 knowing。请与 cook / work 等活动作对照。'
  };
  const continuous=`${s.text} ${s.be} ${a.ing} ${a.rest}.`;
  const isRoutine=lens==='routine';
  return {
    sentence:isRoutine?simple:`${s.text} ${s.be} ${a.ing} ${a.rest}${lens==='now'?' right now':' this week'}.`,
    context:lens==='period'?`设想这周临时由此人安排${a.zh}，你强调当前一周的情况。`:`设想${a.zh}既是此人的日常活动，此刻也正在发生。两句可以同时为真，区别在你要突出什么。`,
    steps:[`意图：${isRoutine?'介绍日常规律':lens==='now'?'报告眼下正在发生':'强调这周临时进行的活动'}`,`主语：${s.text}；${s.meaning}`,isRoutine?`动作：${a.base} → ${simpleVerb}；${s.third?'第三人称单数形式':'本主语用原形'}。`:`动作：先选 ${s.be}，再将 ${a.base} → ${a.ing}；两部分合用。`],
    meaning:isRoutine?'介绍通常的习惯或一般情况；单凭这句不能确定此刻在做。':lens==='now'?'在本情境中报告这次活动正在进行；不说明它是不是日常习惯。':'把活动放进当前一周的临时情况；不保证说话这一秒动作不停。',
    simple,continuous,
    contrast:'保持人物和活动相同：前句看一般情况，后句在当前语境中看进行中的活动。这里去掉时间词，观察形式本身的差别。',
    warning:lens==='period'?'这是第4章的边界预览；本章主要练日常与眼下。':''
  };
}
export const choiceQuestions = [
  {id:'live-cook',prompt:'1 · 视频里，梅此刻正在做晚饭。你要清楚报告她现在忙什么。',options:[
    {text:'She cooks dinner.',kind:'meaning',feedback:'形式正确，但侧重她平时做晚饭。要明确回答眼下，用 is cooking。'},
    {text:'She is cooking dinner.',kind:'correct',feedback:'符合意图：she 配 is，cooking 表达本次做饭正在进行。'},
    {text:'She cooking dinner.',kind:'form',feedback:'形式错误：cooking 前缺少与 she 配合的 is。'}]},
  {id:'routine-drink',prompt:'2 · 梅现在每晚都喝茶。你在介绍她当前的日常习惯，不是在报告实时画面。',options:[
    {text:'Mei drink tea every evening.',kind:'form',feedback:'本题的一般现在时形式错误：Mei 是一个人，drink 要用 drinks。'},
    {text:'Mei drinks tea every evening.',kind:'correct',feedback:'符合意图：一般现在时概括重复的日常；Mei 配 drinks。'},
    {text:'Mei is drinking tea.',kind:'meaning',feedback:'形式正确，但突出当前正在喝茶；没有清楚表达每晚的习惯。'}]},
  {id:'contraction',prompt:'3 · 她眼下正在做晚饭。两个完整式/缩写选项都可尝试，观察反馈。',options:[
    {text:'She is cooking dinner now.',kind:'correct',feedback:'可接受：完整写出 she is，报告当前活动。'},
    {text:"She's cooking dinner now.",kind:'correct',feedback:'同样可接受：本句 she’s = she is，缩写不改变含义。'},
    {text:'She is cooks dinner now.',kind:'form',feedback:'形式错误：is 后这里需要 cooking，不能再用 cooks。'}]},
  {id:'know-now',prompt:'4 · 你终于明白了，想说“我现在知道答案了”。',options:[
    {text:'I know the answer now.',kind:'correct',feedback:'符合意图：know 表达知道这一状态；即使有 now，也用 know。'},
    {text:'I am knowing the answer now.',kind:'form',feedback:'本例形式不合适：普通“知道”意义的 know 不这样用进行时，改为 I know。'},
    {text:'I knows the answer now.',kind:'form',feedback:'形式错误：主语 I 用 know；knows 用于 he/she/一个人名。'}]},
  {id:'same-scene',prompt:'5 · 梅平时在家工作，今天视频里也正在家工作。“Mei works at home.”与“Mei is working at home.”如何理解？',options:[
    {text:'两句都可以成立，前句概括常态，后句突出当前活动。',kind:'correct',feedback:'正确：同一事实可从不同角度表达。形式正确并不等于两句信息完全相同。'},
    {text:'第一句永远错误，因为现在应当加 ing。',kind:'meaning',feedback:'不能这样判断。一般现在时可以概括她现在的通常工作情况。'},
    {text:'第二句证明她每天都在家工作。',kind:'meaning',feedback:'推断过强。进行中的一次或当前一段时间的活动，不等于日常规律。'}]},
  {id:'period',prompt:'6 · 梅说“I am working at home this week.”，此刻她可以在喝茶吗？',options:[
    {text:'可以。这句话介绍当前一周的工作安排，不保证这一秒工作不停。',kind:'correct',feedback:'正确：现在进行时也可覆盖当前一段时间；这周临时在家工作与此刻休息不矛盾。'},
    {text:'不可以，进行时一定表示这一秒动作不停。',kind:'meaning',feedback:'边界判断有误。this week 使我们理解当前一段时间的情况，而不是持续不停的监控画面。'}]}
];
export const gapQuestions = [
  {id:'cooking',label:'1 · 补全进行时',prompt:'视频里她正在做饭：She ___ dinner right now. (cook)',instruction:'只填空缺的动词部分，可以不止一个词。',accepted:['is cooking'],reference:'is cooking',reason:'she 配 is，cook 变 cooking；两部分一起表达眼下活动。',known:{'cooking':['form','少了 is。进行时要有 be 和 ing。'],'cooks':['meaning','cooks 适合介绍日常；此题要报告眼下，用 is cooking。'],'is cook':['form','is 后需要 cooking。']}},
  {id:'drinks',label:'2 · 补全日常句',prompt:'介绍梅现在每晚的习惯：Mei ___ tea every evening. (drink)',instruction:'只填空缺的动词。',accepted:['drinks'],reference:'drinks',reason:'Mei 是一个人，按 she 处理，一般现在时用 drinks。',known:{'drink':['form','本题的一般现在时需要第三人称单数形式 drinks。'],'is drinking':['meaning','本题意图是日常习惯，参考 drinks；is drinking 把重点转到当前活动。']}},
  {id:'repair',label:'3 · 修正完整句',prompt:'纠错：She cooking dinner now.',instruction:'写完整修正句，保留原本“她现在正在做饭”的意思。',accepted:['She is cooking dinner now.',"She's cooking dinner now.",'She is now cooking dinner.',"She's now cooking dinner."],reference:"She is cooking dinner now. / She's cooking dinner now.",reason:'补 is，或用 she’s 缩写；两种形式都表达现在正在做饭。',known:{'she cooking dinner now':['form','仍然少了 is，请保留 be + ing。'],'she is cooks dinner now':['form','is 后需要 cooking。']}},
  {id:'know',label:'4 · 修正状态表达',prompt:'纠错：I am knowing the answer now.',instruction:'写完整修正句，意思是“我现在知道答案了”。',accepted:['I know the answer now.','Now I know the answer.','I now know the answer.'],reference:'I know the answer now. / Now I know the answer.',reason:'know 的普通“知道”意义不用进行时。合理调整 now 的位置也可接受。',known:{'i am knowing the answer now':['form','本例不用 am knowing，直接用 know。'],'i knows the answer now':['form','I 配 know，不是 knows。']}}
];
export function normalizeAnswer(value) {
  return value.normalize('NFKC').replace(/[’‘]/g,"'").trim().toLowerCase().replace(/[.,!?，。！？]/g,'').replace(/\s+/g,' ');
}
export function checkGap(id,value) {
  const q=gapQuestions.find(item=>item.id===id);
  if(!q) throw new Error('找不到本题。');
  const normalized=normalizeAnswer(value);
  if(!normalized) return {kind:'empty',feedback:'先输入你的答案，再核对。'};
  if(q.accepted.some(answer=>normalizeAnswer(answer)===normalized)) return {kind:'correct',feedback:`可接受。${q.reason}`};
  if(q.known[normalized]) { const [kind,feedback]=q.known[normalized]; return {kind,feedback}; }
  return {kind:'review',feedback:`这段输入不在本题的有限自动核对范围内，尚未判定对错。参考：${q.reference}。依据：${q.reason} 请比较你是否保留题目要求的意思和成分；自由改写请使用下面的评价表。`};
}
export const rubric = [
  {id:'information',title:'信息清楚',levels:['看不出日常与眼下的主要信息','少一句或一处人物/活动不清','两句日常、两句眼下能理解，人物明确']},
  {id:'meaning',title:'含义合适',levels:['反复混淆平时与当前','大致符合，一处平时/当前不清','句式符合语境，同一活动对照成立']},
  {id:'form',title:'形式完整',levels:['多次缺关键成分，影响理解','一两处能自行修订的小错','动词与主语对应，进行时有合适的be和ing']},
  {id:'revision',title:'解释与修订',levels:['只复制，无法说明理由','能说明含义变化或修订理由其中一项','能说明一次含义变化并有理由地修订']}
];
