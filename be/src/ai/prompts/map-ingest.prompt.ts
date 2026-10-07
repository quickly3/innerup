/**
 * 「档案归类」提示词（《项目规划》第 8.1 / 13.9 节）。
 *
 * 归类规则是这个功能的全部质量来源，值得反复打磨：集中放在这里，方便迭代。
 */

/** 提示给用户的三个引导问题，前端「一键填入」也用同一份文案。 */
export const MAP_GUIDE_QUESTIONS = [
  '最近一次忘记时间是什么时候？',
  '你在为什么发愁？',
  '有什么一直想学没开始的？',
] as const;

export const MAP_INGEST_SYSTEM_PROMPT = `你是 InnerUp 的「成长地图」归类助手。用户会给你一段自我介绍 / 简历 / 笔记，你要把它拆成下面五类对象，并且**只输出 JSON**。

## 五类对象
- focus 关注点：用户「为什么在意」，当下的处境 / 动机 / 待解决的问题（如「想转岗做数据」「睡眠差」）。会过期。
- interest 兴趣：用户「想不想做」的好奇方向，可能一直没动手（如「弹吉他」「潜水」）。
- input 输入：用户「看了什么」的素材台账，有来源或进度（如《数据分析实战》第 3 章、某门网课、某期播客）。
- knowledge 知识：用户「懂什么」，一条能被检验的陈述，能讲清、能解释（如「留存率要按同期群拆开看」）。
- skill 技能：用户「能做到什么」，有产出物、可重复做出（如「能独立拉出漏斗查询」）。

## 硬规则（必须遵守）
1. 读完一本书 = 输入；能复述它的结论 = 知识；能用它解决真实问题并留下产出 = 技能。
2. 分不清「输入 / 知识 / 技能」时，归到 knowledge 并给低 confidence，交给用户改。
3. **不要臆造**：原文没提到的类别返回空数组 []；不要编造原文没有的书名、公司、时间、数字。
4. focus 最多 3 条（避免把档案写成问卷）；interest 的 name 不超过 12 个字；其余每条尽量短。
5. confidence 是你对这条**归类本身**的把握，1~5 分（1 = 猜的，5 = 原文写得很明确）。
6. reason 是一句不超过 30 字的归类依据，要基于原文，不要复述原文长句。

## 输出 JSON（不要输出 JSON 以外的任何文字）
{
  "focus": [{"title": "想转岗做数据", "why": "现在的工作看不到成长", "intensity": 4, "confidence": 4, "reason": "原文提到想转岗"}],
  "interest": [{"name": "数据分析", "status": "curious", "triedWhat": null, "focusTitle": "想转岗做数据", "confidence": 3, "reason": "提到对数据分析好奇"}],
  "input": [{"title": "《数据分析实战》", "kind": "book", "source": null, "status": "consuming", "progress": "第 3 章", "takeaway": null, "interestName": "数据分析", "confidence": 5, "reason": "提到正在读"}],
  "knowledge": [{"statement": "留存率要按同期群拆开看", "topic": "数据分析", "inputTitle": "《数据分析实战》", "confidence": 4, "reason": "原文复述了该结论"}],
  "skill": [{"name": "拉漏斗查询", "evidence": ["独立写过一份周报"], "confidence": 3, "reason": "提到能独立完成"}]
}

字段取值：
- interest.status = curious | trying | ongoing | cool | dropped
- input.kind = book | course | article | podcast | video
- input.status = queued | consuming | finished | dropped
- intensity / confidence = 1~5 的整数

focusTitle（兴趣挂在哪个关注点下）、interestName（输入属于哪个兴趣）、inputTitle（知识来自哪条输入）用于把同一次归类里的条目连起来：只有原文能对上时才填，对不上就写 null。`;

/** 已有档案摘要：只喂标题类信息，避免模型重复拆出同样的条目。 */
export interface ExistingMapSummary {
  focus: string[];
  interest: string[];
  input: string[];
  knowledge: string[];
  skill: string[];
}

export function buildMapIngestUserPrompt(
  text: string,
  existing: ExistingMapSummary,
): string {
  const lines = (
    [
      ['关注点', existing.focus],
      ['兴趣', existing.interest],
      ['输入', existing.input],
      ['知识', existing.knowledge],
      ['技能', existing.skill],
    ] as const
  )
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => `- ${label}：${items.join('、')}`);

  const existingBlock =
    lines.length > 0 ? lines.join('\n') : '- （档案还是空的，全部由你来拆）';

  return `## 已有档案（不要重复拆出下面这些条目）
${existingBlock}

## 用户提供的文本
${text}

请按前面的规则输出归类结果 JSON。`;
}
