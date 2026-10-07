import type { Routes } from '@angular/router';

/**
 * 路由表。
 *
 * 约定：**全部懒加载**（`loadComponent`），按 `features/` 目录组织。
 * M2 起骨架已完整；M3 起逐个把占位页（`shared/page-placeholder`）换成真实页面。
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'InnerUp · 面板',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'goals',
    title: 'InnerUp · 目标',
    loadComponent: () =>
      import('./features/goals/goal-list').then((m) => m.GoalList),
  },
  {
    path: 'quests',
    title: 'InnerUp · 任务',
    loadComponent: () =>
      import('./features/quests/quest-list').then((m) => m.QuestList),
  },
  {
    path: 'profile',
    title: 'InnerUp · 角色卡',
    loadComponent: () =>
      import('./features/profile/profile').then((m) => m.Profile),
  },
  {
    path: 'insights',
    title: 'InnerUp · 复盘',
    loadComponent: () =>
      import('./features/insights/insights').then((m) => m.Insights),
  },
  { path: '**', redirectTo: 'dashboard' },
];
