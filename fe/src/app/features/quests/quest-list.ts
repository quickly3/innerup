import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../shared/page-placeholder/page-placeholder';

/**
 * 任务列表（含今日任务）。M2 占位，M3 实现列表，M5 加打卡与 XP。
 */
@Component({
  selector: 'app-quest-list',
  imports: [PagePlaceholder],
  template: `
    <app-page-placeholder
      icon="task_alt"
      title="任务"
      milestone="M3 目标与任务"
      description="今日任务与全部任务的列表。完成任务后打卡，记录投入时长与总结，并拿到经验值。"
      [planned]="planned"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestList {
  protected readonly planned: readonly string[] = [
    '任务列表，支持 ?date=today 只看今天',
    '状态流转：todo → doing → done',
    'M5 起：打卡记录、XP 结算与连续天数',
  ];
}
