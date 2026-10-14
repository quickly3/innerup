import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';

import { describeHttpError } from '../../core/api/http-error';
import {
  GOAL_STATUSES,
  GOAL_STATUS_LABELS,
  GoalService,
  type GoalStatus,
  type GoalWithCounts,
} from '../../core/api/goal.service';

/**
 * 目标（任务线）列表（M3）。
 *
 * 只做「创建 + 查看 + 改状态 + 删除」；任务的增删改在目标详情里。
 * M4 会在这里加「AI 生成任务线」入口（`POST /api/goals/:id/generate`）。
 */
@Component({
  selector: 'app-goal-list',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './goal-list.html',
  styleUrl: './goal-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalList {
  private readonly goals = inject(GoalService);

  protected readonly statuses = GOAL_STATUSES;
  protected readonly statusLabels = GOAL_STATUS_LABELS;

  protected readonly list = signal<GoalWithCounts[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<string | null>(null);

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly creating = signal(false);

  protected readonly totals = computed(() => {
    const goals = this.list();

    return {
      goals: goals.length,
      quests: goals.reduce((sum, goal) => sum + goal.questCounts.total, 0),
      done: goals.reduce((sum, goal) => sum + goal.questCounts.done, 0),
    };
  });

  constructor() {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    this.goals.list().subscribe({
      next: (list) => {
        this.list.set(list);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeHttpError(error));
      },
    });
  }

  protected createGoal(): void {
    const title = this.title().trim();

    if (title.length === 0) {
      this.error.set('先给目标起个名字，例如「学会弹吉他」');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.goals.create({ title, description: this.description().trim() || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.creating.set(false);
        this.title.set('');
        this.description.set('');
        this.refresh();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(describeHttpError(error));
      },
    });
  }

  protected changeStatus(goal: GoalWithCounts, status: GoalStatus): void {
    if (goal.status === status) return;

    this.busyId.set(goal.id);
    this.goals.update(goal.id, { status }).subscribe({
      next: () => {
        this.busyId.set(null);
        this.refresh();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.error.set(describeHttpError(error));
      },
    });
  }

  protected remove(goal: GoalWithCounts): void {
    const warning =
      goal.questCounts.total > 0
        ? `它会连同 ${goal.questCounts.total} 个任务一起删除，确定吗？`
        : '确定删除这个目标吗？';

    if (!window.confirm(warning)) return;

    this.busyId.set(goal.id);
    this.goals.remove(goal.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.refresh();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.error.set(describeHttpError(error));
      },
    });
  }

  /** 进度百分比；一条任务都没有时返回 0（进度条此时也不显示）。 */
  protected progressOf(goal: GoalWithCounts): number {
    const { total, done } = goal.questCounts;
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }

  protected toggleCreate(): void {
    this.creating.update((value) => !value);
    this.error.set(null);
  }
}
