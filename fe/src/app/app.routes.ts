import type { Routes } from '@angular/router';

/**
 * 路由表。
 *
 * 约定：**全部懒加载**（`loadComponent`），按 `features/` 目录组织。
 * M1 只有角色面板；M3 起会陆续加上 goals / quests / insights。
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'InnerUp · 角色面板',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  { path: '**', redirectTo: 'dashboard' },
];
