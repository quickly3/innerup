import { z } from 'zod';

import {
  looseEnum,
  looseInt,
  optionalText,
  requiredText,
} from './schema-helpers.js';

/**
 * 「AI 生成任务线」的结构化输出契约（《项目规划》第 8.1 节 · M4）。
 *
 * 与归类一样走宽容解析：枚举 / 数值归一化 + 兜底，模型给出的字段歪一点不该整条任务线失败。
 * 两处刻意的取舍：
 * - **逐条过滤**：`title` 写坏的那一条直接丢掉，不让它拖垮整批（不同于归类按类整体兜底）；
 * - **一条都不剩就算失败**：不落库半条任务线，交给 `AiService` 重试、上层转 503 降级；
 * - `acceptance`（验收标准）不单独建列，落库时并进 `Quest.description`
 *   （《项目规划》第 7 节：M4 不改表结构）。
 */

/** 任务类型（《项目规划》第 13.1 节的硬规则）：读完 / 能复述 / 能解决问题并留下产出。 */
const QUEST_KINDS = ['input', 'practice', 'output'] as const;

/** 预计时长：允许模型不给（给 null），但不允许给 0 或离谱的大数。 */
const estMinutes = z.coerce
  .number()
  .int()
  .min(5)
  .max(600)
  .nullish()
  .transform((value) => value ?? null)
  .catch(null);

/** 一条 AI 设计的任务。 */
export const plannedQuestSchema = z.object({
  title: requiredText(200),
  description: optionalText(300),
  acceptance: optionalText(200),
  kind: looseEnum(QUEST_KINDS, 'practice'),
  difficulty: looseInt(1, 5, 1),
  xpReward: looseInt(5, 200, 10),
  estMinutes,
});

/** 逐条解析，只丢掉不合格的那一条。 */
const questList = z
  .array(z.unknown())
  .transform(filterValidQuests)
  .refine((quests) => quests.length > 0, { message: '至少需要 1 条可用任务' });

export const generateQuestsResultSchema = z.object({
  /** 把用户写的目标改写成可验收的标题；不想改就原样返回。 */
  goalTitle: optionalText(120),
  quests: questList,
});

function filterValidQuests(items: unknown[]): PlannedQuest[] {
  return items.flatMap((item) => {
    const parsed = plannedQuestSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export type GenerateQuestsResult = z.infer<typeof generateQuestsResultSchema>;
export type PlannedQuest = z.infer<typeof plannedQuestSchema>;
