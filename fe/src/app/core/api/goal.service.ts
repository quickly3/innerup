/**
 * 目标（任务线）与任务的类型与服务（《项目规划》第 3.4 / 6 节 · M3）。
 *
 * 与后端 `be/src/goals` 的 DTO 一一对应；路径不写 `/api`
 * （`apiInterceptor` 会补 `environment.apiBaseUrl` 并解包 `{ code, data, message }`）。
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

export const GOAL_STATUSES = ['active', 'paused', 'done'] as const;
export const QUEST_STATUSES = ['todo', 'doing', 'done'] as const;

/**
 * 任务类型（《项目规划》第 13.1 节硬规则）：
 * 读完 = `input`，能复述 = `practice`（练习 / 掌握），能解决问题并留下产出 = `output`。
 */
export const QUEST_KINDS = ['input', 'practice', 'output'] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type QuestStatus = (typeof QUEST_STATUSES)[number];
export type QuestKind = (typeof QUEST_KINDS)[number];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: '进行中',
  paused: '暂停',
  done: '已完成',
};

export const QUEST_STATUS_LABELS: Record<QuestStatus, string> = {
  todo: '待开始',
  doing: '进行中',
  done: '已完成',
};

export const QUEST_KIND_LABELS: Record<QuestKind, string> = {
  input: '输入',
  practice: '练习',
  output: '产出',
};

export const QUEST_KIND_ICONS: Record<QuestKind, string> = {
  input: 'menu_book',
  practice: 'fitness_center',
  output: 'flag_circle',
};

export const QUEST_KIND_HINTS: Record<QuestKind, string> = {
  input: '读完 / 看完，把素材吃进来',
  practice: '能复述、能上手，把它变成自己的',
  output: '能用它解决真实问题，并留下产出',
};

/** 任务线级别的硬要求：输入与产出要交替，别只读不练（《项目规划》第 13.1 节）。 */
export const KIND_BALANCE_HINT = '任务线要「输入」与「产出」交替：只读不练、只练不用都不算成长。';

/**
 * AI 生成任务线的落库方式（《项目规划》第 8.1 节 · M4）：
 * `append` 追加到末尾；`replace` 先清掉还没开始（todo）的任务再写入。
 */
export const QUEST_PLAN_MODES = ['append', 'replace'] as const;

export type QuestPlanMode = (typeof QUEST_PLAN_MODES)[number];

export const QUEST_PLAN_MODE_LABELS: Record<QuestPlanMode, string> = {
  append: '追加到末尾',
  replace: '替换未开始的任务',
};

export const QUEST_PLAN_MODE_HINTS: Record<QuestPlanMode, string> = {
  append: '保留现有任务，把新任务接在最后',
  replace: '清掉还没开始（待开始）的任务再写入，正在做与已完成的保留',
};

/** 每周可投入小时数的范围，与后端 DTO 一致。 */
export const MIN_WEEKLY_HOURS = 1;
export const MAX_WEEKLY_HOURS = 40;

export interface QuestCounts {
  total: number;
  done: number;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  createdAt: string;
}

export interface GoalWithCounts extends Goal {
  questCounts: QuestCounts;
}

export interface Quest {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  difficulty: number;
  xpReward: number;
  estMinutes: number | null;
  order: number;
  status: QuestStatus;
  kind: QuestKind;
  dueDate: string | null;
}

export interface GoalDetail extends Goal {
  quests: Quest[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface QuestListResult {
  records: Quest[];
  pagination: Pagination;
}

export interface GoalPayload {
  title: string;
  description?: string;
}

export interface QuestPayload {
  goalId?: string;
  title?: string;
  description?: string | null;
  kind?: QuestKind;
  difficulty?: number;
  xpReward?: number;
  estMinutes?: number;
  order?: number;
  status?: QuestStatus;
  dueDate?: string | null;
}

/** `POST /api/goals/:id/generate` 的请求体（《项目规划》第 8.1 节 · M4）。 */
export interface QuestPlanPayload {
  currentLevel?: string;
  weeklyHours?: number;
  mode?: QuestPlanMode;
}

/** `POST /api/goals/:id/generate` 的返回体：任务**已经落库**。 */
export interface GeneratedQuestPlan {
  goalId: string;
  /** AI 建议的目标标题（把目标改写成可验收的说法）；没有建议时为 null。 */
  suggestedTitle: string | null;
  created: Quest[];
  replaced: number;
  /** `ai` 模型生成；`template` AI 不可用时的兜底模板（《项目规划》第 8.2 节）。 */
  source: QuestPlanSource;
  meta: {
    /** 参与设计的档案条目数，0 表示档案还是空的（只能按通用路径生成）。 */
    mapItems: number;
    weeklyHours: number | null;
  };
}

/** 任务线是谁给的：模型生成 / 兜底模板。 */
export type QuestPlanSource = 'ai' | 'template';

export const QUEST_PLAN_SOURCE_HINTS: Record<QuestPlanSource, string> = {
  ai: '依据你的目标与档案生成',
  template: 'AI 暂时不可用，已按通用模板生成',
};

/** 一组任务里是否缺了某一类（详情页提示「只读不练」）。 */
export function missingKinds(quests: Quest[]): QuestKind[] {
  return QUEST_KINDS.filter((kind) => !quests.some((quest) => quest.kind === kind));
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly http = inject(HttpClient);

  list(): Observable<GoalWithCounts[]> {
    return this.http.get<GoalWithCounts[]>('/goals');
  }

  detail(id: string): Observable<GoalDetail> {
    return this.http.get<GoalDetail>(`/goals/${id}`);
  }

  create(payload: GoalPayload): Observable<Goal> {
    return this.http.post<Goal>('/goals', payload);
  }

  update(id: string, payload: Partial<GoalPayload> & { status?: GoalStatus }): Observable<Goal> {
    return this.http.patch<Goal>(`/goals/${id}`, payload);
  }

  remove(id: string): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(`/goals/${id}`);
  }

  /** AI 生成任务线（M4）：同步等待；AI 不可用时后端用通用模板兜底（`source` 会标注）。 */
  generateQuests(id: string, payload: QuestPlanPayload): Observable<GeneratedQuestPlan> {
    return this.http.post<GeneratedQuestPlan>(`/goals/${id}/generate`, payload);
  }
}

@Injectable({ providedIn: 'root' })
export class QuestService {
  private readonly http = inject(HttpClient);

  list(
    filters: { goalId?: string; status?: QuestStatus; date?: 'today' } = {},
  ): Observable<QuestListResult> {
    let params = new HttpParams();

    if (filters.goalId) params = params.set('goalId', filters.goalId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.date) params = params.set('date', filters.date);

    return this.http.get<QuestListResult>('/quests', { params });
  }

  create(payload: QuestPayload): Observable<Quest> {
    return this.http.post<Quest>('/quests', payload);
  }

  update(id: string, payload: QuestPayload): Observable<Quest> {
    return this.http.patch<Quest>(`/quests/${id}`, payload);
  }

  remove(id: string): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(`/quests/${id}`);
  }
}
