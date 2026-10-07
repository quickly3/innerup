// 临时诊断脚本：证明「去重」是不是候选变少的主因。
// A/B：同一份 GitHub 正文，一次带真实已有档案摘要，一次带空档案。
import { config } from 'dotenv';
config({ path: 'd:/www/innerup/be/.env', quiet: true });

const { ConfigService } = await import('@nestjs/config');
const { AiService } = await import('../dist/ai/ai.service.js');
const { GithubReadmeService } = await import('../dist/growth/github-readme.service.js');
const { mapIngestResultSchema } = await import('../dist/ai/schemas/map-ingest.schema.js');
const { MAP_GITHUB_INGEST_SYSTEM_PROMPT, buildMapGithubUserPrompt } = await import(
  '../dist/ai/prompts/map-ingest.prompt.js'
);

const cfg = new ConfigService(process.env);
const github = new GithubReadmeService(cfg);
const ai = new AiService(cfg);

const bundle = await github.fetchReadmes('https://github.com/quickly3');
const has = (needle) => bundle.text.includes(needle);

console.log('正文总字数:', bundle.text.length);
console.log('读完的仓库:', bundle.repos.map((r) => r.fullName).join(', '));
console.log('含 quickly3/quickly3 段:', has('### 仓库：quickly3/quickly3'));
console.log('含「资深全栈架构师」:', has('资深全栈架构师'));
console.log('含「10 万/小时」:', has('10 万/小时'));
console.log('');

const realExisting = {
  focus: ['求职成都全栈工程师', '保持技术前沿洞察', '承担架构与技术决策角色', '用 AI 研究中国神话叙事'],
  interest: [],
  input: [],
  knowledge: [
    '高并发服务可用消息队列加自研并发量控制实现削峰限流',
    'Postgresql 到 Elasticsearch 的 ETL 可自动生成 mapping 并同步',
    'AI 编程工具存在能力边界，需按成本与性能切换模型',
    '多数据源录入需用工作流分层管理数据生命周期',
    'AI 生成神话内容需以文本证据与知识约束为前提，而非只模仿风格',
    '把神话角色放进知识图谱后，可分析共现关系、形象演变与叙事模式',
  ],
  skill: [
    'AI 编程工具应用',
    '全栈开发',
    '大数据建模与预测服务开发',
    '搜索引擎开发与调优',
    '搭建 Angular + NestJS 全栈项目骨架',
    '数据抓取服务开发',
    '系统架构设计与落地',
    '线上故障排查与救火',
    '高并发消息分发服务开发',
  ],
};

const emptyExisting = { focus: [], interest: [], input: [], knowledge: [], skill: [] };

for (const [label, existing] of [
  ['A 空档案（首次录入）', emptyExisting],
  ['B 真实已有档案（去重开启）第 1 次', realExisting],
  ['B 真实已有档案（去重开启）第 2 次', realExisting],
  ['B 真实已有档案（去重开启）第 3 次', realExisting],
]) {
  const started = Date.now();

  try {
    const result = await ai.completeJson({
      system: MAP_GITHUB_INGEST_SYSTEM_PROMPT,
      user: buildMapGithubUserPrompt('quickly3', bundle.text, existing),
      schema: mapIngestResultSchema,
      maxTokens: 4000,
    });

    const counts = {
      focus: result.focus.length,
      interest: result.interest.length,
      input: result.input.length,
      knowledge: result.knowledge.length,
      skill: result.skill.length,
    };

    console.log(`=== ${label}（${((Date.now() - started) / 1000).toFixed(1)}s）`);
    console.log(
      '  条数:',
      JSON.stringify(counts),
      '总计',
      Object.values(counts).reduce((a, b) => a + b, 0),
    );
    console.log('  focus:', result.focus.map((i) => i.title).join(' | '));
    console.log('  skill:', result.skill.map((i) => i.name).join(' | '));
    console.log('  knowledge:', result.knowledge.map((i) => i.statement.slice(0, 24)).join(' | '));
    console.log('');
  } catch (error) {
    console.log(`=== ${label} → 失败：${error.message}`);
    console.log('');
  }
}
