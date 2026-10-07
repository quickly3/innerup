import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { AppModule } from './../src/app.module.js';

/**
 * 成长地图（M2.5）的端到端验收：
 * 走真实的 Controller → Service → Prisma → 远端 PostgreSQL，覆盖录入 / 归类落库 / 管理。
 *
 * 测试会往库里写数据，所以约定**测试数据一律以 `e2e` 开头**，
 * 并在每个用例前后按前缀清理（见 `sweepTestData`）——
 * 这样即使某个用例中途断言失败，也不会把脏数据留在开发库里。
 * 数据库不可用（`/health` 报 `down`）时整体跳过，避免没有数据库的环境（如 CI）失败。
 */
describe('Map (e2e)', () => {
  const TEST_PREFIX = 'e2e';

  let app: INestApplication<App>;
  let databaseReady = false;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const health = await http().get('/health').expect(200);
    databaseReady = health.body.data?.database === 'up';

    if (!databaseReady) {
      console.warn('[map.e2e] 数据库不可用，跳过成长地图端到端测试');
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await sweepTestData();
  });

  afterEach(async () => {
    await sweepTestData();
  });

  /** 删掉所有以 `e2e` 开头的档案条目；与用例结果无关，保证「跑完即干净」。 */
  async function sweepTestData(): Promise<void> {
    if (!databaseReady) return;

    const snapshot = await http().get('/map').expect(200);
    const data = snapshot.body.data;

    for (const kind of ['focus', 'interest', 'input', 'knowledge', 'skill']) {
      for (const row of data[kind] as Array<{
        id: string;
        title?: string;
        name?: string;
        statement?: string;
      }>) {
        const label = row.title ?? row.name ?? row.statement ?? '';
        if (label.startsWith(TEST_PREFIX)) {
          await http().delete(`/map/${kind}/${row.id}`).expect(200);
        }
      }
    }
  }

  it('手动新增五类对象 + 查询快照 + 更新 + 删除', async () => {
    if (!databaseReady) return;

    const focus = await http()
      .post('/map/focus')
      .send({ title: 'e2e 想转岗做数据', why: '看不到成长', intensity: 4 })
      .expect(201);
    expect(focus.body.code).toBe(0);

    const interest = await http()
      .post('/map/interest')
      .send({ name: 'e2e 数据分析', focusId: focus.body.data.id })
      .expect(201);

    const input = await http()
      .post('/map/input')
      .send({
        title: 'e2e《数据分析实战》',
        kind: 'book',
        interestId: interest.body.data.id,
        status: 'consuming',
      })
      .expect(201);

    const knowledge = await http()
      .post('/map/knowledge')
      .send({ statement: 'e2e 留存率要按同期群拆开看', topic: '数据分析' })
      .expect(201);

    const skill = await http()
      .post('/map/skill')
      .send({ name: 'e2e 拉漏斗查询', evidence: ['周报'] })
      .expect(201);

    const snapshot = await http().get('/map').expect(200);
    expect(snapshot.body).toMatchObject({ code: 0, message: 'ok' });

    const data = snapshot.body.data;
    expect(
      data.focus.find((item: { id: string }) => item.id === focus.body.data.id),
    ).toMatchObject({
      title: 'e2e 想转岗做数据',
      intensity: 4,
      status: 'active',
    });
    expect(
      data.interest.find(
        (item: { id: string }) => item.id === interest.body.data.id,
      ).focusId,
    ).toBe(focus.body.data.id);
    expect(
      data.input.find((item: { id: string }) => item.id === input.body.data.id),
    ).toMatchObject({
      interestId: interest.body.data.id,
      status: 'consuming',
      minutes: 0,
    });
    expect(
      data.knowledge.find(
        (item: { id: string }) => item.id === knowledge.body.data.id,
      ),
    ).toMatchObject({ statement: 'e2e 留存率要按同期群拆开看', confidence: 3 });
    expect(
      data.skill.find((item: { id: string }) => item.id === skill.body.data.id),
    ).toMatchObject({ name: 'e2e 拉漏斗查询', evidence: ['周报'] });

    // 状态推进：queued → consuming → finished
    const patched = await http()
      .patch(`/map/input/${input.body.data.id}`)
      .send({ status: 'finished', progress: '读完了' })
      .expect(200);
    expect(patched.body.data).toMatchObject({
      status: 'finished',
      progress: '读完了',
    });

    // 清空可空关联
    const unlinked = await http()
      .patch(`/map/interest/${interest.body.data.id}`)
      .send({ focusId: null })
      .expect(200);
    expect(unlinked.body.data.focusId).toBeNull();

    // 非本类字段直接 400，不静默忽略
    await http()
      .patch(`/map/focus/${focus.body.data.id}`)
      .send({ statement: '这是知识的字段' })
      .expect(400);

    // 非法状态值 400
    await http()
      .patch(`/map/focus/${focus.body.data.id}`)
      .send({ status: 'whatever' })
      .expect(400);

    // 未知 kind 400
    await http()
      .patch(`/map/unknown/${focus.body.data.id}`)
      .send({ status: 'active' })
      .expect(400);

    // 不存在的条目 → 404
    await http().delete('/map/focus/not-exist-id').expect(404);

    // 删除后不再出现在快照里
    await http().delete(`/map/skill/${skill.body.data.id}`).expect(200);
    const afterDelete = await http().get('/map').expect(200);
    expect(
      afterDelete.body.data.skill.some(
        (item: { id: string }) => item.id === skill.body.data.id,
      ),
    ).toBe(false);
  });

  it('确认候选落库时自动挂好同批次的关联，并跳过同名技能', async () => {
    if (!databaseReady) return;

    const applied = await http()
      .post('/map/candidates/apply')
      .send({
        candidates: {
          focus: [
            {
              title: 'e2e 想转岗做数据',
              why: '看不到成长',
              intensity: 4,
              confidence: 4,
              reason: '原文明确提到',
            },
          ],
          interest: [
            {
              name: 'e2e 数据分析',
              status: 'trying',
              focusTitle: 'e2e 想转岗做数据',
              confidence: 4,
            },
          ],
          input: [
            {
              title: 'e2e《数据分析实战》',
              kind: 'book',
              status: 'consuming',
              progress: '第 3 章',
              interestName: 'e2e 数据分析',
              confidence: 5,
            },
          ],
          knowledge: [
            {
              statement: 'e2e 留存率要按同期群拆开看',
              topic: '数据分析',
              inputTitle: 'e2e《数据分析实战》',
              confidence: 3,
            },
          ],
          skill: [
            { name: 'e2e 拉漏斗查询', evidence: ['周报'], confidence: 4 },
            // 同批次里的重名会被去重，只落一条
            { name: 'e2e 拉漏斗查询', confidence: 2 },
          ],
        },
      })
      .expect(201);

    expect(applied.body.data).toEqual({
      created: { focus: 1, interest: 1, input: 1, knowledge: 1, skill: 1 },
      skipped: { skill: 0 },
    });

    const snapshot = await http().get('/map').expect(200);
    const data = snapshot.body.data;

    const focus = data.focus.find(
      (item: { title: string }) => item.title === 'e2e 想转岗做数据',
    );
    const interest = data.interest.find(
      (item: { name: string }) => item.name === 'e2e 数据分析',
    );
    const input = data.input.find(
      (item: { title: string }) => item.title === 'e2e《数据分析实战》',
    );
    const knowledge = data.knowledge.find(
      (item: { statement: string }) =>
        item.statement === 'e2e 留存率要按同期群拆开看',
    );
    const skill = data.skill.find(
      (item: { name: string }) => item.name === 'e2e 拉漏斗查询',
    );

    expect(focus).toBeTruthy();
    expect(interest.focusId).toBe(focus.id);
    expect(input.interestId).toBe(interest.id);
    expect(knowledge.sourceInputId).toBe(input.id);
    expect(skill.evidence).toEqual(['周报']);

    // 同名技能再次确认 → 视为已存在，跳过而不是建重复行
    const reapplied = await http()
      .post('/map/candidates/apply')
      .send({
        candidates: {
          skill: [{ name: 'e2e 拉漏斗查询', confidence: 4 }],
        },
      })
      .expect(201);

    expect(reapplied.body.data).toEqual({
      created: { focus: 0, interest: 0, input: 0, knowledge: 0, skill: 0 },
      skipped: { skill: 1 },
    });
  });

  it('文本太短时直接 400，不调用 AI', async () => {
    if (!databaseReady) return;

    const response = await http()
      .post('/map/ingest')
      .send({ text: 'hi' })
      .expect(400);

    expect(response.body.message).toContain('内容太短');
  });
});
