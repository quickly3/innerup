import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePlaceholder } from '../../shared/page-placeholder/page-placeholder';

/**
 * 复盘与洞察（AI 周报 / 月报）。不在 MVP 范围内，M2 仅留路由占位。
 */
@Component({
  selector: 'app-insights',
  imports: [PagePlaceholder],
  template: `
    <app-page-placeholder
      icon="insights"
      title="复盘"
      milestone="MVP 之后"
      description="AI 总结你一段时间的投入分布、进步轨迹与兴趣演化，并给出下一步建议。MVP 阶段先不做，只保留入口。"
      [planned]="planned"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Insights {
  protected readonly planned: readonly string[] = [
    '周报 / 月报：投入时间分布与进步轨迹',
    '兴趣演化趋势：「这两周你在写作上投入最多」',
    'SSE 流式输出（GET /api/insights/weekly）',
  ];
}
