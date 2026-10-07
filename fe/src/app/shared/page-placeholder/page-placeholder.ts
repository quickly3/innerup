import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

/**
 * 尚未实现页面的统一占位卡片。
 *
 * M2 只搭路由骨架与基础布局，M3 起逐个把 `features/` 下的占位页换成真实页面。
 */
@Component({
  selector: 'app-page-placeholder',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './page-placeholder.html',
  styleUrl: './page-placeholder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagePlaceholder {
  readonly icon = input('construction');

  readonly title = input.required<string>();

  /** 计划在哪个里程碑实现，如「M3 目标与任务」。 */
  readonly milestone = input('');

  readonly description = input('');

  /** 该页面将要提供的能力清单。 */
  readonly planned = input<readonly string[]>([]);
}
