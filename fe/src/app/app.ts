import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** 顶部导航项，与 `app.routes.ts` 的一级路由一一对应。 */
interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/** 应用外壳：顶部导航 + 路由出口。 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly navItems: readonly NavItem[] = [
    { path: '/dashboard', label: '面板', icon: 'dashboard' },
    { path: '/goals', label: '目标', icon: 'flag' },
    { path: '/quests', label: '任务', icon: 'task_alt' },
    { path: '/profile', label: '角色卡', icon: 'military_tech' },
    { path: '/insights', label: '复盘', icon: 'insights' },
  ];
}
