import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { describeHttpError } from '../../../core/api/http-error';
import {
  GOAL_STATUSES,
  GOAL_STATUS_LABELS,
  KIND_BALANCE_HINT,
  MAX_WEEKLY_HOURS,
  MIN_WEEKLY_HOURS,
  QUEST_KIND_HINTS,
  QUEST_KIND_LABELS,
  QUEST_KINDS,
  QUEST_PLAN_MODE_HINTS,
  QUEST_PLAN_MODE_LABELS,
  QUEST_PLAN_MODES,
  GoalService,
  QuestService,
  missingKinds,
  type GeneratedQuestPlan,
  type GoalDetail,
  type GoalStatus,
  type Quest,
  type QuestKind,
  type QuestPayload,
  type QuestPlanMode,
} from '../../../core/api/goal.service';
import { QuestCard } from '../../../shared/quest-card/quest-card';

/**
 * 目标详情：任务线里的任务清单 + 手动添加 + **AI 生成任务线（M4）**。
 *
 * 排序约定：`order` 升序（并列时按 id），上移 / 下移在这里换算成新的 `order`。
 * AI 生成是**同步请求 + 直接入库**，所以生成期间禁用按钮，返回后刷新任务清单。
 */
@Component({
  selector: 'app-goal-detail',
  imports: [
    FormsModule,
    RouterLink,
    QuestCard,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './goal-detail.html',
  styleUrl: './goal-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalDetailPage implements OnInit {
  /**
   * 来自路由参数（`withComponentInputBinding()` 已开启）。
   *
   * 注意：**路由输入是在构造完成后才写入的**，所以首次请求要放在 `ngOnInit`，
   * 不能在构造函数里调 `refresh()`（会拿到 undefined）。
   */
  readonly id = input.required<string>();

  private readonly goals = inject(GoalService);
  private readonly quests = inject(QuestService);

  protected readonly statuses = GOAL_STATUSES;
  protected readonly statusLabels = GOAL_STATUS_LABELS;
  protected readonly kinds = QUEST_KINDS;
  protected readonly kindLabels = QUEST_KIND_LABELS;
  protected readonly kindHints = QUEST_KIND_HINTS;
  protected readonly kindBalanceHint = KIND_BALANCE_HINT;
  protected readonly planModes = QUEST_PLAN_MODES;
  protected readonly planModeLabels = QUEST_PLAN_MODE_LABELS;
  protected readonly planModeHints = QUEST_PLAN_MODE_HINTS;
  protected readonly minWeeklyHours = MIN_WEEKLY_HOURS;
  protected readonly maxWeeklyHours = MAX_WEEKLY_HOURS;

  protected readonly goal = signal<GoalDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  // ── 手动添加任务
  protected readonly adding = signal(false);
  protected readonly newTitle = signal('');
  protected readonly newKind = signal<QuestKind>('input');
  protected readonly newDescription = signal('');

  // ── AI 生成任务线
  protected readonly planOpen = signal(false);
  protected readonly planning = signal(false);
  protected readonly planError = signal<string | null>(null);
  /** 生成成功后的提示（条数、参考了几条档案、AI 建议的标题）。 */
  protected readonly planResult = signal<GeneratedQuestPlan | null>(null);
  protected readonly planLevel = signal('');
  protected readonly planHours = signal<number | null>(null);
  protected readonly planMode = signal<QuestPlanMode>('append');

  protected readonly balance = computed(() => missingKinds(this.goal()?.quests ?? []));

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    this.goals.detail(this.id()).subscribe({
      next: (goal) => {
        this.goal.set(goal);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeHttpError(error));
      },
    });
  }

  protected changeStatus(status: GoalStatus): void {
    this.goals.update(this.id(), { status }).subscribe({
      next: () => this.refresh(),
      error: (error: unknown) => this.error.set(describeHttpError(error)),
    });
  }

  protected addQuest(): void {
    const title = this.newTitle().trim();

    if (title.length === 0) {
      this.error.set('先写一句任务内容');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.quests
      .create({
        goalId: this.id(),
        title,
        kind: this.newKind(),
        description: this.newDescription().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.newTitle.set('');
          this.newDescription.set('');
          this.refresh();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(describeHttpError(error));
        },
      });
  }

  /** 任务卡片上任何字段的改动都统一走这里，改完重新拉取。 */
  protected saveQuest(questId: string, payload: QuestPayload): void {
    this.quests.update(questId, payload).subscribe({
      next: () => this.refresh(),
      error: (error: unknown) => this.error.set(describeHttpError(error)),
    });
  }

  protected removeQuest(quest: Quest): void {
    if (!window.confirm(`确定删除任务「${quest.title}」吗？`)) return;

    this.quests.remove(quest.id).subscribe({
      next: () => this.refresh(),
      error: (error: unknown) => this.error.set(describeHttpError(error)),
    });
  }

  /**
   * 上移 / 下移：与相邻任务交换 `order`。
   * 两者可能同为初始值 0（老数据），这时用步长重新铺一遍顺序。
   */
  protected move(step: -1 | 1, index: number): void {
    const quests = this.goal()?.quests ?? [];
    const target = index + step;

    if (target < 0 || target >= quests.length) return;

    const current = quests[index];
    const neighbor = quests[target];
    const currentOrder = neighbor.order === current.order ? 10 : neighbor.order;
    const neighborOrder = neighbor.order === current.order ? 20 : current.order;

    this.quests.update(current.id, { order: currentOrder }).subscribe({
      next: () => {
        this.quests.update(neighbor.id, { order: neighborOrder }).subscribe({
          next: () => this.refresh(),
          error: (error: unknown) => this.error.set(describeHttpError(error)),
        });
      },
      error: (error: unknown) => this.error.set(describeHttpError(error)),
    });
  }

  protected progress(): number {
    const quests = this.goal()?.quests ?? [];

    if (quests.length === 0) return 0;

    const done = quests.filter((quest) => quest.status === 'done').length;
    return Math.round((done / quests.length) * 100);
  }

  protected doneCount(): number {
    return (this.goal()?.quests ?? []).filter((quest) => quest.status === 'done').length;
  }

  protected questCount(): number {
    return this.goal()?.quests.length ?? 0;
  }

  protected toggleAdding(): void {
    this.adding.update((value) => !value);
    this.error.set(null);
  }

  // ── AI 生成任务线（M4）

  protected togglePlanning(): void {
    this.planOpen.update((value) => !value);
    this.planError.set(null);
  }

  /**
   * 生成任务线：同步请求（AI 可能要十几秒），成功后后端已落库，这里刷新清单即可。
   * AI 不可用时后端会用**通用模板**兜底（响应里的 `source` 标注），页面据此给出明确提示；
   * 真正的失败（校验 / 目标不存在）只提示错误，不清空页面。
   */
  protected generateQuests(): void {
    const hours = this.planHours();
    const level = this.planLevel().trim();

    if (
      hours !== null &&
      (!Number.isInteger(hours) || hours < MIN_WEEKLY_HOURS || hours > MAX_WEEKLY_HOURS)
    ) {
      this.planError.set(
        `每周可投入时间要填 ${MIN_WEEKLY_HOURS}~${MAX_WEEKLY_HOURS} 之间的整数小时`,
      );
      return;
    }
    if (
      this.planMode() === 'replace' &&
      !window.confirm('会清掉这条任务线里还没开始的任务（正在做 / 已完成的不受影响），继续吗？')
    ) {
      return;
    }

    this.planning.set(true);
    this.planError.set(null);
    this.planResult.set(null);

    this.goals
      .generateQuests(this.id(), {
        ...(level.length > 0 ? { currentLevel: level } : {}),
        ...(hours !== null ? { weeklyHours: hours } : {}),
        mode: this.planMode(),
      })
      .subscribe({
        next: (plan) => {
          this.planning.set(false);
          this.planResult.set(plan);
          this.planLevel.set('');
          this.planHours.set(null);
          this.refresh();
        },
        error: (error: unknown) => {
          this.planning.set(false);
          this.planError.set(describeHttpError(error));
        },
      });
  }

  /** 采纳 AI 建议的目标标题（生成不会直接改标题，由用户点一下）。 */
  protected adoptSuggestedTitle(title: string): void {
    this.goals.update(this.id(), { title }).subscribe({
      next: () => {
        this.planResult.update((plan) => (plan ? { ...plan, suggestedTitle: null } : plan));
        this.refresh();
      },
      error: (error: unknown) => this.planError.set(describeHttpError(error)),
    });
  }
}
