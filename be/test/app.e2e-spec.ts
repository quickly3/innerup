import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /health 返回统一响应体与健康状态', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      code: 0,
      message: 'ok',
      data: {
        status: 'ok',
        // 本地/CI 未配置 DATABASE_URL 时为 'down'，连上远端库后为 'up'
        database: expect.stringMatching(/^(up|down)$/) as unknown as string,
      },
    });
  });

  it('未知路由返回统一错误结构', async () => {
    const response = await request(app.getHttpServer())
      .get('/not-exist')
      .expect(404);

    expect(response.body).toMatchObject({
      code: 404,
      data: null,
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
