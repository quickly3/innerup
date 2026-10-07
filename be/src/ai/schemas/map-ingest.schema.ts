import { z } from 'zod';

/**
 * 「档案归类」的结构化输出契约（《项目规划》第 8.1 / 13.9 节）。
 *
 * 约定：每条候选都带 `confidence`（AI 对**归类本身**的把握 1~5）与 `reason`（一句归类依据）。
 * 解析刻意写得宽容（枚举归一化 + 兜底默认值），因为整批归类不能因为一个字段写错就失败；
 * 真正的结构校验由「用户确认后落库」时的 class-validator DTO 负责。
 */

const confidence = z.coerce.number().int().min(1).max(5).catch(3);

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null))
    .catch(null);

/** 模型常把枚举写成大写或带空格；归一化后仍不认识就退回默认值。 */
function looseEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.enum(values).catch(fallback),
  );
}

const INTEREST_STATUSES = [
  'curious',
  'trying',
  'ongoing',
  'cool',
  'dropped',
] as const;
const INPUT_KINDS = [
  'book',
  'course',
  'article',
  'podcast',
  'video',
] as const;
const INPUT_STATUSES = ['queued', 'consuming', 'finished', 'dropped'] as const;

export const focusCandidateSchema = z.object({
  title: requiredText(120),
  why: optionalText(300),
  intensity: z.coerce.number().int().min(1).max(5).catch(3),
  confidence,
  reason: optionalText(200),
});

export const interestCandidateSchema = z.object({
  name: requiredText(60),
  status: looseEnum(INTEREST_STATUSES, 'curious'),
  triedWhat: optionalText(200),
  /** 挂到同一次归类里的哪个关注点上（按标题匹配）；填不上就为 null。 */
  focusTitle: optionalText(120),
  confidence,
  reason: optionalText(200),
});

export const inputCandidateSchema = z.object({
  title: requiredText(200),
  kind: looseEnum(INPUT_KINDS, 'book'),
  source: optionalText(200),
  status: looseEnum(INPUT_STATUSES, 'queued'),
  progress: optionalText(60),
  takeaway: optionalText(300),
  /** 挂到同一次归类里的哪个兴趣上（按名称匹配）。 */
  interestName: optionalText(60),
  confidence,
  reason: optionalText(200),
});

export const knowledgeCandidateSchema = z.object({
  statement: requiredText(300),
  topic: optionalText(60),
  /** 来自同一次归类里的哪条输入（按标题匹配）。 */
  inputTitle: optionalText(200),
  confidence,
  reason: optionalText(200),
});

export const skillCandidateSchema = z.object({
  name: requiredText(60),
  evidence: z.array(z.string().trim().min(1).max(300)).catch([]),
  confidence,
  reason: optionalText(200),
});

export const mapIngestResultSchema = z.object({
  focus: z.array(focusCandidateSchema).catch([]),
  interest: z.array(interestCandidateSchema).catch([]),
  input: z.array(inputCandidateSchema).catch([]),
  knowledge: z.array(knowledgeCandidateSchema).catch([]),
  skill: z.array(skillCandidateSchema).catch([]),
});

export type MapIngestResult = z.infer<typeof mapIngestResultSchema>;
export type FocusCandidate = z.infer<typeof focusCandidateSchema>;
export type InterestCandidate = z.infer<typeof interestCandidateSchema>;
export type InputCandidate = z.infer<typeof inputCandidateSchema>;
export type KnowledgeCandidate = z.infer<typeof knowledgeCandidateSchema>;
export type SkillCandidate = z.infer<typeof skillCandidateSchema>;
