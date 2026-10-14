import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import {
  QUEST_KIND_HINTS,
  QUEST_KIND_ICONS,
  QUEST_KIND_LABELS,
  QUEST_KINDS,
  QUEST_STATUS_LABELS,
  QUEST_STATUSES,
  type Quest,
  type QuestPayload,
} from '../../core/api/goal.service';

/**
 * 任务卡片（M3）：改状态 / 类型 / 难度 / XP / 预计时长 / 排序 / 删除。
 *
 * 目标详情（按任务线看）与任务页（跨任务线看）共用这一份；**数据请求由页面负责**，
 * 这里只渲染并派发事件，父组件收到后调接口再重新拉取。
 */
@Component({
  selector: 'app-quest-card',
  imports: [
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './quest-card.html',
  styleUrl: './quest-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestCard {
  readonly quest = input.required<Quest>();
  /** 跨任务线的列表里显示所属目标；目标详情里传 null。 */
  readonly goalTitle = input<string | null>(null);
  /** 是否显示上移 / 下移（任务线内部调整顺序）。 */
  readonly sortable = input(false);
  readonly canMoveUp = input(false);
  readonly canMoveDown = input(false);

  readonly changed = output<QuestPayload>();
  readonly removed = output<void>();
  readonly moved = output<-1 | 1>();

  protected readonly statuses = QUEST_STATUSES;
  protected readonly statusLabels = QUEST_STATUS_LABELS;
  protected readonly kinds = QUEST_KINDS;
  protected readonly kindLabels = QUEST_KIND_LABELS;
  protected readonly kindIcons = QUEST_KIND_ICONS;
  protected readonly kindHints = QUEST_KIND_HINTS;
  protected readonly difficulties = [1, 2, 3, 4, 5];

  /**
   * 截止时间在 `<input type="date">` 里要的是**本地时区**的 `YYYY-MM-DD`。
   *
   * 存库走的是本地零点对应的 UTC 时刻（见 `commitDueDate`），两端一致，
   * 这样 `?date=today`（按本地日界过滤）与页面显示才不会差一天。
   */
  protected readonly dueDateValue = computed(() => {
    const due = this.quest().dueDate;

    return due ? toDateInputValue(new Date(due)) : '';
  });

  /**
   * 标题失焦时提交，并把输入框恢复成当前值：
   * 成功后父组件会重新拉取带来新标题；失败时这里不留「改了没生效」的假象。
   */
  protected commitTitle(input: HTMLInputElement): void {
    const title = input.value.trim();
    input.value = this.quest().title;

    if (title.length > 0 && title !== this.quest().title) {
      this.changed.emit({ title });
    }
  }

  /** 难度 / XP / 预计时长共用：非数字或负数时还原，避免把脏值写进库。 */
  protected commitNumber(
    field: 'difficulty' | 'xpReward' | 'estMinutes',
    input: HTMLInputElement,
  ): void {
    const value = Number(input.value);

    if (input.value.trim().length === 0 || !Number.isInteger(value) || value < 0) {
      input.value = String(this.quest()[field] ?? '');
      return;
    }
    if (value === this.quest()[field]) {
      return;
    }

    this.changed.emit({ [field]: value });
  }

  /** 选日期 → 本地零点对应的 UTC 时刻；清空 → `null`（后端按清空处理）。 */
  protected commitDueDate(input: HTMLInputElement): void {
    const value = input.value;

    if (value.length === 0) {
      input.value = this.dueDateValue();
      return;
    }

    this.changed.emit({ dueDate: new Date(`${value}T00:00:00`).toISOString() });
  }

  protected clearDueDate(): void {
    this.changed.emit({ dueDate: null });
  }
}

function toDateInputValue(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}
