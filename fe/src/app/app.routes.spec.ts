import { routes } from './app.routes';

/** M2 的页面路由（全部懒加载）。 */
const pageRoutes = routes.filter((route) => route.loadComponent);

describe('app routes (M2 骨架)', () => {
  it('should contain the route skeleton', () => {
    expect(routes.map((route) => route.path)).toEqual([
      '',
      'dashboard',
      'goals',
      'quests',
      'profile',
      'insights',
      '**',
    ]);
  });

  it('should lazy load every feature page', async () => {
    expect(pageRoutes.map((route) => route.path)).toEqual([
      'dashboard',
      'goals',
      'quests',
      'profile',
      'insights',
    ]);

    for (const route of pageRoutes) {
      const loaded = await route.loadComponent?.();
      expect(loaded).toBeTruthy();
    }
  });

  it('should give every page a document title', () => {
    for (const route of pageRoutes) {
      expect(route.title).toContain('InnerUp');
    }
  });
});
