import type { Goal, Quest } from '../generated/prisma/client.js';

/** 任务线是谁给的：模型生成 / 兜底模板（《项目规划》第 8.2 节的降级）。 */
export type QuestPlanSource = 'ai' | 'template';

/** 目标的任务进度：列表页只显示「几个任务、完成几个」，不用把任务全拉下来。 */
export interface QuestCounts {
  total: number;
  done: number;
}

/** `GET /api/goals` 的列表项。 */
export interface GoalWithCounts extends Goal {
  questCounts: QuestCounts;
}

/** `GET /api/goals/:id` 的详情：目标 + 按顺序排好的任务。 */
export interface GoalDetail extends Goal {
  quests: Quest[];
}

/** 分页元信息，字段固定为 `page / pageSize / total`。 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

/** `GET /api/quests` 的返回体：`data = { records, pagination }`。 */
export interface QuestListResult {
  records: Quest[];
  pagination: Pagination;
}

/**
 * `POST /api/goals/:id/generate`（AI 生成任务线）的返回体 · M4。
 *
 * 生成即落库（《项目规划》第 8.1 节：结构化输出入库），所以这里回传**已入库的任务**，
 * 前端拿到后直接刷新任务清单，不需要再猜哪些是这次生成的。
 */
export interface GeneratedQuestPlan {
  goalId: string;
  /** AI 建议的目标标题（把目标改写成可验收的说法）；没建议或与现标题一致时为 `null`。 */
  suggestedTitle: string | null;
  /** 本次生成并落库的任务（按落库顺序）。 */
  created: Quest[];
  /** `replace` 模式下被清掉的「还没开始」任务数。 */
  replaced: number;
  /** `ai` 模型生成 / `template` AI 不可用时的兜底模板（《项目规划》第 8.2 节）。 */
  source: QuestPlanSource;
  meta: QuestPlanMeta;
}

export interface QuestPlanMeta {
  /** 参与设计的档案条目数（五类合计）：前端据此提示「AI 参考了几条档案」。 */
  mapItems: number;
  /** 回显每周可投入小时数。 */
  weeklyHours: number | null;
}
