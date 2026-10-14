/**
 * 目标（任务线）与任务的常量（《项目规划》第 3.4 / 7 节 · M3）。
 *
 * 状态与类型都用 `String` + 代码层常量（不新增 Prisma enum），
 * 与成长地图的 `growth.constants.ts` 保持一致的做法。
 */

/** 目标状态：`active` 进行中 / `paused` 暂停 / `done` 已完成。 */
export const GOAL_STATUSES = ['active', 'paused', 'done'] as const;

/** 任务状态：M3 手动推进；M5 起由打卡触发完成。 */
export const QUEST_STATUSES = ['todo', 'doing', 'done'] as const;

/**
 * 任务类型（《项目规划》第 13.1 节的硬规则）：
 * `input` 读完 / `practice` 能复述 / `output` 能解决问题并留下产出。
 * 任务线必须输入与产出交替，所以这个字段从 M3 起就是必填语义。
 */
export const QUEST_KINDS = ['input', 'practice', 'output'] as const;

/** 手动创建任务时的顺序步长：留出插入空间，方便后续拖拽排序。 */
export const QUEST_ORDER_STEP = 10;

export const DEFAULT_QUEST_DIFFICULTY = 1;
export const DEFAULT_QUEST_XP = 10;
export const DEFAULT_QUEST_KIND = 'practice';

/** 任务列表分页（《项目规划》第 6 节 · 返回 `data.pagination`）。 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ── AI 生成任务线（《项目规划》第 8.1 节 · M4）────────────────────────

/**
 * 生成结果的落库方式：
 * - `append` 追加到任务线末尾；
 * - `replace` 先清掉该任务线下**还没开始**（`todo`）的任务再写入——
 *   在做 / 已完成的任务与打卡记录保留，重新生成不会毁掉已有进度。
 */
export const QUEST_PLAN_MODES = ['append', 'replace'] as const;

export const DEFAULT_QUEST_PLAN_MODE = 'append';

/**
 * 任务线是谁给的：
 * - `ai` 模型生成；
 * - `template` AI 不可用时的**兜底模板**（《项目规划》第 8.2 节），
 *   前端据此明确标注「非 AI 生成」，避免用户误以为是个性化结果。
 */
export const QUEST_PLAN_SOURCES = ['ai', 'template'] as const;

/** 一次生成并落库的任务条数上限（《项目规划》第 4 节：一条任务线 3~7 个任务）。 */
export const MAX_PLANNED_QUESTS = 7;

/** 「每周可投入时间」的合理范围，用来约束任务量与步长。 */
export const MIN_WEEKLY_HOURS = 1;
export const MAX_WEEKLY_HOURS = 40;

/** 生成任务线的事务超时：条数不多，但每条都要走一次远端数据库。 */
export const PLAN_TRANSACTION_TIMEOUT_MS = 20_000;
