import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../shared/page-placeholder/page-placeholder';

/**
 * 目标（任务线）列表。M2 占位，M3 实现 CRUD 与列表展示。
 */
@Component({
  selector: 'app-goal-list',
  imports: [PagePlaceholder],
  template: `
    <app-page-placeholder
      icon="flag"
      title="目标"
      milestone="M3 目标与任务"
      description="这里会列出你的任务线：每个目标下挂着若干任务，可以手动增删改、调整顺序，之后还能让 AI 一次生成整条任务线。"
      [planned]="planned"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalList {
  protected readonly planned: readonly string[] = [
    '目标列表：标题、状态、任务数与整体进度',
    '新建目标：输入「我想提升 XX」',
    '目标详情：任务清单与排序',
    'M4 起：AI 一键生成 / 补充任务线',
  ];
}
