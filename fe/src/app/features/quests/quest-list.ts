import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';

import { describeHttpError } from '../../core/api/http-error';
import {
  GoalService,
  QuestService,
  QUEST_STATUS_LABELS,
  QUEST_STATUSES,
  type GoalWithCounts,
  type Quest,
  type QuestPayload,
  type QuestStatus,
} from '../../core/api/goal.service';
import { QuestCard } from '../../shared/quest-card/quest-card';

type Scope = 'today' | 'all';
type Filter = QuestStatus | 'all';

/**
 * 任务列表（M3）：跨任务线看任务，支持「今日 / 全部」与状态筛选。
 *
 * 打卡、XP 结算与热力图在 M5；导入或编辑任务在目标详情页。
 */
@Component({
  selector: 'app-quest-list',
  imports: [
    FormsModule,
    QuestCard,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './quest-list.html',
  styleUrl: './quest-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestList {
  private readonly questService = inject(QuestService);
  private readonly goalService = inject(GoalService);

  protected readonly statuses = QUEST_STATUSES;
  protected readonly statusLabels = QUEST_STATUS_LABELS;
  protected readonly scopes: Scope[] = ['today', 'all'];
  protected readonly filters: Filter[] = ['all', ...QUEST_STATUSES];

  protected readonly scope = signal<Scope>('today');
  protected readonly filter = signal<Filter>('all');

  protected readonly records = signal<Quest[]>([]);
  protected readonly total = signal(0);
  protected readonly goalTitles = signal<Record<string, string>>({});
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly doneCount = computed(
    () => this.records().filter((quest) => quest.status === 'done').length,
  );

  constructor() {
    this.loadGoals();
    this.refresh();
  }

  protected changeScope(scope: Scope): void {
    this.scope.set(scope);
    this.refresh();
  }

  protected changeFilter(filter: Filter): void {
    this.filter.set(filter);
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    const filter = this.filter();

    this.questService
      .list({
        ...(this.scope() === 'today' ? { date: 'today' as const } : {}),
        ...(filter === 'all' ? {} : { status: filter }),
      })
      .subscribe({
        next: (result) => {
          this.records.set(result.records);
          this.total.set(result.pagination.total);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(describeHttpError(error));
        },
      });
  }

  protected saveQuest(questId: string, payload: QuestPayload): void {
    this.questService.update(questId, payload).subscribe({
      next: () => this.refresh(),
      error: (error: unknown) => this.error.set(describeHttpError(error)),
    });
  }

  protected removeQuest(quest: Quest): void {
    if (!window.confirm(`确定删除任务「${quest.title}」吗？`)) return;

    this.questService.remove(quest.id).subscribe({
      next: () => this.refresh(),
      error: (error: unknown) => this.error.set(describeHttpError(error)),
    });
  }

  /** 任务所属目标的名字，用于跨任务线列表；拿不到就退化成「目标」入口。 */
  private loadGoals(): void {
    this.goalService.list().subscribe({
      next: (goals) => this.goalTitles.set(toTitleMap(goals)),
      error: () => this.goalTitles.set({}),
    });
  }
}

function toTitleMap(goals: GoalWithCounts[]): Record<string, string> {
  return Object.fromEntries(goals.map((goal) => [goal.id, goal.title]));
}
