import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { AiUnavailableError } from './../src/ai/ai.errors.js';
import { AiService } from './../src/ai/ai.service.js';
import type { GenerateQuestsResult } from './../src/ai/schemas/generate-quests.schema.js';
import { AppModule } from './../src/app.module.js';

/**
 * 目标与任务（M3）+ AI 生成任务线（M4）的端到端验收：
 * 走真实的 Controller → Service → Prisma → 远端 PostgreSQL。
 *
 * 与 `map.e2e-spec.ts` 同一套约定：测试数据一律以 `e2e` 开头，用例前后按前缀清理；
 * 数据库不可用（`/health` 报 `down`）时整体跳过，避免没有数据库的环境（如 CI）失败。
 *
 * **AI 必须打桩**：端到端测试不能依赖真实模型（不确定、要花钱、要 Key），
 * 所以用 `aiQueue` 按队列喂 `AiService.completeJson` 的返回值，
 * 队列空了就抛「AI 不可用」，用来验证**模板兜底**（`source: 'template'`）这条降级路径。
 */
describe('Goals / Quests (e2e)', () => {
  const TEST_PREFIX = 'e2e';

  let app: INestApplication<App>;
  let databaseReady = false;

  const aiQueue: Array<GenerateQuestsResult | Error> = [];
  const aiStub = {
    available: true,
    completeJson: async () => {
      const next = aiQueue.shift();

      if (next instanceof Error) throw next;
      if (!next) throw new AiUnavailableError('未配置 AI_API_KEY');

      return next;
    },
  };

  /** 排一份「AI 生成任务线」的返回结果，覆盖交替的输入 / 练习 / 产出三类。 */
  function queuePlan(goalTitle: string | null, titles: string[]): void {
    aiQueue.push({
      goalTitle,
      quests: titles.map((title, index) => ({
        title,
        description: `${title} 的做法`,
        acceptance: `${title} 能验收`,
        kind: (['input', 'practice', 'output'] as const)[index % 3],
        difficulty: (index % 5) + 1,
        xpReward: 10 * (index + 1),
        estMinutes: 30,
      })),
    });
  }

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiService)
      .useValue(aiStub)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const health = await http().get('/health').expect(200);
    databaseReady = health.body.data?.database === 'up';

    if (!databaseReady) {
      console.warn('[goals.e2e] 数据库不可用，跳过目标与任务端到端测试');
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    aiQueue.length = 0;
    await sweepTestData();
  });

  afterEach(async () => {
    await sweepTestData();
  });

  /** 删掉所有以 `e2e` 开头的目标（任务与打卡由外键级联删除）。 */
  async function sweepTestData(): Promise<void> {
    if (!databaseReady) return;

    const list = await http().get('/goals').expect(200);

    for (const goal of list.body.data as Array<{ id: string; title: string }>) {
      if (goal.title.startsWith(TEST_PREFIX)) {
        await http().delete(`/goals/${goal.id}`).expect(200);
      }
    }
  }

  it('目标 CRUD：创建 → 列表带进度 → 详情 → 改状态 → 删除', async () => {
    if (!databaseReady) return;

    const created = await http()
      .post('/goals')
      .send({ title: 'e2e 学会弹吉他', description: '每天 15 分钟' })
      .expect(201);

    expect(created.body).toMatchObject({ code: 0, message: 'ok' });
    const goalId = created.body.data.id as string;
    expect(created.body.data).toMatchObject({
      title: 'e2e 学会弹吉他',
      description: '每天 15 分钟',
      status: 'active',
    });

    // 新建的任务线还没有任务
    const list = await http().get('/goals').expect(200);
    const listed = (
      list.body.data as Array<{ id: string; questCounts: unknown }>
    ).find((goal) => goal.id === goalId);
    expect(listed).toMatchObject({ questCounts: { total: 0, done: 0 } });

    // 详情结构：目标 + 任务数组
    const detail = await http().get(`/goals/${goalId}`).expect(200);
    expect(detail.body.data).toMatchObject({ id: goalId, quests: [] });

    const patched = await http()
      .patch(`/goals/${goalId}`)
      .send({ status: 'paused' })
      .expect(200);
    expect(patched.body.data.status).toBe('paused');

    await http().delete(`/goals/${goalId}`).expect(200);

    const afterDelete = await http().get('/goals').expect(200);
    expect(
      (afterDelete.body.data as Array<{ id: string }>).some(
        (goal) => goal.id === goalId,
      ),
    ).toBe(false);
  });

  it('任务 CRUD：创建 → 列表分页 → 进度统计 → 状态流转 → 删除', async () => {
    if (!databaseReady) return;

    const goal = await http()
      .post('/goals')
      .send({ title: 'e2e 任务线' })
      .expect(201);
    const goalId = goal.body.data.id as string;

    const first = await http()
      .post('/quests')
      .send({
        goalId,
        title: 'e2e 认识持琴姿势',
        kind: 'input',
        difficulty: 1,
        xpReward: 10,
        estMinutes: 30,
      })
      .expect(201);

    const second = await http()
      .post('/quests')
      .send({
        goalId,
        title: 'e2e 练熟 C / G / Am',
        kind: 'practice',
        xpReward: 20,
      })
      .expect(201);

    // 未传 order 时按步长排在末尾
    expect(second.body.data.order as number).toBeGreaterThan(
      first.body.data.order as number,
    );

    const list = await http().get('/quests').query({ goalId }).expect(200);
    expect(list.body.data).toMatchObject({
      pagination: { page: 1, pageSize: 20, total: 2 },
    });
    expect((list.body.data.records as unknown[]).length).toBe(2);
    // order 升序：先创建的排前面
    expect(list.body.data.records[0].id).toBe(first.body.data.id);

    // 完成后目标进度跟着变
    await http()
      .patch(`/quests/${first.body.data.id}`)
      .send({ status: 'done' })
      .expect(200);

    const goals = await http().get('/goals').expect(200);
    const listed = (
      goals.body.data as Array<{ id: string; questCounts: unknown }>
    ).find((row) => row.id === goalId);
    expect(listed).toMatchObject({ questCounts: { total: 2, done: 1 } });

    const detail = await http().get(`/goals/${goalId}`).expect(200);
    expect((detail.body.data.quests as Array<{ id: string }>)[0].id).toBe(
      first.body.data.id,
    );

    await http().delete(`/quests/${first.body.data.id}`).expect(200);

    const afterDelete = await http()
      .get('/quests')
      .query({ goalId })
      .expect(200);
    expect(afterDelete.body.data.pagination.total).toBe(1);
  });

  it('?date=today 取今天到期 / 正在做 / 逾期未完成的任务', async () => {
    if (!databaseReady) return;

    const goal = await http()
      .post('/goals')
      .send({ title: 'e2e 今日任务线' })
      .expect(201);
    const goalId = goal.body.data.id as string;
    const dueToday = new Date();
    dueToday.setHours(12, 0, 0, 0);

    const due = await http()
      .post('/quests')
      .send({ goalId, title: 'e2e 今天到期', dueDate: dueToday.toISOString() })
      .expect(201);

    const overdue = await http()
      .post('/quests')
      .send({
        goalId,
        title: 'e2e 逾期未完成',
        dueDate: '2026-01-01T00:00:00.000Z',
      })
      .expect(201);

    const later = await http()
      .post('/quests')
      .send({
        goalId,
        title: 'e2e 下周再说',
        dueDate: '2099-01-01T00:00:00.000Z',
      })
      .expect(201);

    const today = await http()
      .get('/quests')
      .query({ goalId, date: 'today' })
      .expect(200);
    const ids = (today.body.data.records as Array<{ id: string }>).map(
      (row) => row.id,
    );

    expect(ids).toContain(due.body.data.id);
    expect(ids).toContain(overdue.body.data.id);
    expect(ids).not.toContain(later.body.data.id);
  });

  it('校验与错误：goalId 不存在 400、非法枚举 400、空 PATCH 400、不存在的 id 404', async () => {
    if (!databaseReady) return;

    await http()
      .post('/quests')
      .send({ goalId: 'not-exist-goal', title: 'e2e 孤儿任务' })
      .expect(400);

    const goal = await http()
      .post('/goals')
      .send({ title: 'e2e 校验线' })
      .expect(201);
    const goalId = goal.body.data.id as string;

    await http()
      .post('/quests')
      .send({ goalId, title: 'e2e 任务', kind: 'reading' })
      .expect(400);
    await http()
      .patch(`/goals/${goalId}`)
      .send({ status: 'archived' })
      .expect(400);
    await http().patch(`/goals/${goalId}`).send({}).expect(400);
    await http().get('/goals/not-exist-goal').expect(404);
    await http()
      .patch('/quests/not-exist-quest')
      .send({ status: 'done' })
      .expect(404);
    await http().delete('/quests/not-exist-quest').expect(404);
  });

  it('AI 生成任务线（M4）：落库 → 建议标题 → 再次生成是追加', async () => {
    if (!databaseReady) return;

    const goal = await http()
      .post('/goals')
      .send({ title: 'e2e 学会弹吉他', description: '能弹唱几首歌' })
      .expect(201);
    const goalId = goal.body.data.id as string;

    queuePlan('e2e 能弹唱 3 首民谣', [
      'e2e 认识持琴姿势',
      'e2e 练熟 C / G / Am',
      'e2e 录一段 30 秒弹唱',
    ]);

    const generated = await http()
      .post(`/goals/${goalId}/generate`)
      .send({ currentLevel: '零基础', weeklyHours: 5 })
      .expect(201);

    expect(generated.body.data.created).toHaveLength(3);
    // 目标标题不同 → 作为建议回传，但不直接改库（用户自己决定）
    expect(generated.body.data.suggestedTitle).toBe('e2e 能弹唱 3 首民谣');
    expect(generated.body.data.source).toBe('ai');
    expect(generated.body.data.replaced).toBe(0);
    expect(generated.body.data.meta).toMatchObject({ weeklyHours: 5 });

    const detail = await http().get(`/goals/${goalId}`).expect(200);
    expect(detail.body.data.title).toBe('e2e 学会弹吉他');

    const quests = detail.body.data.quests as Array<{
      title: string;
      kind: string;
      order: number;
      description: string;
    }>;
    expect(quests.map((quest) => quest.title)).toEqual([
      'e2e 认识持琴姿势',
      'e2e 练熟 C / G / Am',
      'e2e 录一段 30 秒弹唱',
    ]);
    // 输入 / 练习 / 产出都有，且验收标准并进了 description（M4 不改表结构）
    expect(new Set(quests.map((quest) => quest.kind))).toEqual(
      new Set(['input', 'practice', 'output']),
    );
    expect(quests[0].description).toContain('验收标准：');
    // order 按步长递增，第二次生成接在末尾
    expect(quests[1].order).toBeGreaterThan(quests[0].order);

    queuePlan(null, ['e2e 换一首更难的歌']);
    const again = await http()
      .post(`/goals/${goalId}/generate`)
      .send({})
      .expect(201);

    expect(again.body.data.suggestedTitle).toBeNull();
    const afterAgain = await http().get(`/goals/${goalId}`).expect(200);
    expect((afterAgain.body.data.quests as unknown[]).length).toBe(4);
  });

  it('AI 生成任务线（M4）：mode=replace 只清掉还没开始的任务', async () => {
    if (!databaseReady) return;

    const goal = await http()
      .post('/goals')
      .send({ title: 'e2e 重生成任务线' })
      .expect(201);
    const goalId = goal.body.data.id as string;

    const doing = await http()
      .post('/quests')
      .send({ goalId, title: 'e2e 正在做的任务' })
      .expect(201);
    // `POST /api/quests` 不收 `status`（新建一律 `todo`），先建再推进
    await http()
      .patch(`/quests/${doing.body.data.id}`)
      .send({ status: 'doing' })
      .expect(200);

    const todo = await http()
      .post('/quests')
      .send({ goalId, title: 'e2e 还没开始的任务' })
      .expect(201);

    queuePlan(null, ['e2e 新的第一条', 'e2e 新的第二条']);

    const generated = await http()
      .post(`/goals/${goalId}/generate`)
      .send({ mode: 'replace' })
      .expect(201);

    expect(generated.body.data.replaced).toBe(1);

    const detail = await http().get(`/goals/${goalId}`).expect(200);
    const quests = detail.body.data.quests as Array<{
      id: string;
      title: string;
    }>;

    expect(quests.map((quest) => quest.id)).toContain(doing.body.data.id);
    expect(quests.map((quest) => quest.id)).not.toContain(todo.body.data.id);
    expect(quests.map((quest) => quest.title)).toContain('e2e 新的第一条');
  });

  it('AI 生成任务线（M4）：AI 不可用时用通用模板兜底，仍然落库', async () => {
    if (!databaseReady) return;

    const goal = await http()
      .post('/goals')
      .send({ title: 'e2e 降级任务线' })
      .expect(201);
    const goalId = goal.body.data.id as string;

    // 队列为空 → 桩抛「未配置 AI_API_KEY」→ 走兜底模板（第 8.2 节的降级）
    const generated = await http()
      .post(`/goals/${goalId}/generate`)
      .send({})
      .expect(201);

    expect(generated.body.data.source).toBe('template');
    expect(generated.body.data.suggestedTitle).toBeNull();
    expect(generated.body.data.created.length as number).toBeGreaterThanOrEqual(
      3,
    );

    const detail = await http().get(`/goals/${goalId}`).expect(200);
    const quests = detail.body.data.quests as Array<{
      kind: string;
      title: string;
    }>;

    expect(quests.length).toBe(generated.body.data.created.length);
    expect(new Set(quests.map((quest) => quest.kind))).toEqual(
      new Set(['input', 'practice', 'output']),
    );
  });

  it('AI 生成任务线（M4）：入参越界 400、目标不存在 404，都不调用 AI', async () => {
    if (!databaseReady) return;

    const goal = await http()
      .post('/goals')
      .send({ title: 'e2e 生成校验线' })
      .expect(201);
    const goalId = goal.body.data.id as string;

    await http()
      .post(`/goals/${goalId}/generate`)
      .send({ weeklyHours: 999 })
      .expect(400);
    await http()
      .post(`/goals/${goalId}/generate`)
      .send({ mode: 'merge' })
      .expect(400);
    await http().post('/goals/not-exist-goal/generate').send({}).expect(404);

    expect(aiQueue).toHaveLength(0);
  });
});
