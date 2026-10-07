import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../shared/page-placeholder/page-placeholder';

/**
 * 角色卡（等级 / XP / 技能雷达图）。M2 占位，M5 实现。
 */
@Component({
  selector: 'app-profile',
  imports: [PagePlaceholder],
  template: `
    <app-page-placeholder
      icon="military_tech"
      title="角色卡"
      milestone="M5 打卡与成长"
      description="你的角色面板：等级、总经验值、技能雷达图与已解锁徽章。数据来自 GET /api/profile。"
      [planned]="planned"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  protected readonly planned: readonly string[] = [
    '等级 / 总 XP / 距下一级进度条',
    '技能雷达图（ngx-echarts）',
    '连续打卡天数与累计投入时长',
    '已解锁徽章',
  ];
}
