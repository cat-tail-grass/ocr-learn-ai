#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig, isMainModule } from '../assets/course-site/scripts/course-config.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const usage = '用法：node scripts/init-course.mjs --plan <课程配置.json> --out <新项目目录>';

export function initializeCourse(planPath, outputPath) {
  const config = JSON.parse(readFileSync(path.resolve(planPath), 'utf8'));
  const lessons = validateConfig(config);
  if (lessons.some(lesson => lesson.status !== 'planned')) throw new Error('初始化时章节应为 planned；写好正文后再改 draft');
  const output = path.resolve(outputPath);
  if (output === skillRoot || output.startsWith(skillRoot + path.sep)) throw new Error('请将课程生成到技能目录之外');
  if (existsSync(output) && (lstatSync(output).isSymbolicLink() || !lstatSync(output).isDirectory() || readdirSync(output).length)) throw new Error(`输出目录不是空目录，未写入：${output}`);
  mkdirSync(output, { recursive: true });
  cpSync(path.join(skillRoot, 'assets/course-site'), output, { recursive: true, errorOnExist: true, force: false });
  writeFileSync(path.join(output, 'course.json'), JSON.stringify(config, null, 2) + '\n');
  writeFileSync(path.join(output, '.vuepress/search/terms.mjs'), `export default ${JSON.stringify(config.terms || [])};\n`);
  const code = String.fromCharCode(96);
  writeFileSync(path.join(output, 'README.md'), `# ${config.title}\n\n${config.description}\n\n面向：${config.audience}。\n\n完成目标：${config.outcome}。\n\n<CourseCatalog />\n\n## 开始学习\n\n在项目根目录运行：\n\n${code.repeat(3)}sh\nnpm ci\nnpm run dev\n${code.repeat(3)}\n\n打开 http://127.0.0.1:4173/。先阅读讲义，再通过本章练习核对理解。\n\n构建与预览：${code}npm run build${code}，然后 ${code}npm run preview${code}。\n\n讲义保存后自动更新；实验修改后刷新实验页。新增章节或修改 course.json 后重启服务。\n\n- [完整大纲](OUTLINE.md)\n- [学习目标与约定](COURSE_BRIEF.md)\n- [材料与学习进度](PROGRESS.md)\n`);
  writeFileSync(path.join(output, 'COURSE_BRIEF.md'), `# 学习目标与约定\n\n## 学习者与终点\n\n- 学习者：${config.audience}\n- 目标能力：${config.outcome}\n- 范围：${config.description}\n- 投入时间：尚未约定，按使用者补充更新\n\n## 交付节奏\n\n先完成大纲，再按顺序逐章生成。先交付一节标杆课，由使用者校准后继续。\n\n## 生成分工\n\n主会话依据大纲准备 tasks 中的单章上下文，委派独立子代理生成本章并回报；主会话验收或退回修订，通过后才推进下一章。章节子代理只登记本章 draft，verified 由主会话验收决定。实际执行者、检查与验收结论保存在 reviews。\n\n## 标杆与反馈\n\n标杆章节：${config.calibration.lesson}。校准尚未完成。\n\n## 学习状态\n\n仅根据使用者自述或实际作答记录掌握情况；材料生成和检查通过不改变学习状态。\n`);
  const rows = config.stages.map(stage => `## ${stage.title}\n\n| 章节 | 学习内容 | 前置章节 | 实践载体 |\n| --- | --- | --- | --- |\n` + stage.lessons.map(lesson => `| ${lesson.slug} | ${lesson.title} | ${lesson.prerequisites.join('、') || '见课程前置说明'} | ${[lesson.web ? '网页练习' : null, lesson.node ? 'Node实验' : null, '自测与答案'].filter(Boolean).join('、')} |`).join('\n'));
  writeFileSync(path.join(output, 'OUTLINE.md'), `# 完整学习路线\n\n目标：${config.outcome}\n\n${rows.join('\n\n')}\n`);
  writeFileSync(path.join(output, 'PROGRESS.md'), `# 材料与学习进度\n\n## 材料交付\n\n完整路线已制定，标杆课待生成、检查和使用者校准。章节材料状态以 course.json 为准，实际验收证据放在 reviews。\n\n## 学习者掌握\n\n未评估。依据使用者自述或真实作答逐步更新。\n\n## 下次继续\n\n完成 ${config.calibration.lesson} 标杆课。\n`);
  mkdirSync(path.join(output, 'reviews'));
  mkdirSync(path.join(output, 'tasks'));
  console.log(`课程框架已创建：${output}\n路线包含 ${lessons.length} 章；标杆课 ${config.calibration.lesson} 待编写。`);
  return output;
}

if (isMainModule(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') console.log(usage);
    else {
      const options = {};
      for (let index = 0; index < args.length; index += 2) {
        if (!['--plan', '--out'].includes(args[index]) || !args[index + 1] || Object.hasOwn(options, args[index])) throw new Error(usage);
        options[args[index]] = args[index + 1];
      }
      if (!options['--plan'] || !options['--out']) throw new Error(usage);
      initializeCourse(options['--plan'], options['--out']);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
