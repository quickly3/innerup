import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AiUnavailableError } from './ai.errors.js';
import { AiService } from './ai.service.js';

const looseSchema = z.object({
  items: z.array(z.object({ name: z.string() })).default([]),
});

const strictSchema = z.object({
  items: z.array(z.object({ name: z.string() })),
});

function createService(overrides: Record<string, string> = {}): AiService {
  return new AiService(
    new ConfigService({
      AI_API_KEY: 'test-key',
      AI_BASE_URL: 'https://ai.test/v1',
      AI_MODEL: 'test-model',
      ...overrides,
    }),
  );
}

function completion(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function failure(status: number, body = 'upstream exploded'): Response {
  return new Response(body, { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AiService.completeJson', () => {
  it('未配置 AI_API_KEY 时直接降级，不发起请求', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const service = createService({ AI_API_KEY: '' });

    await expect(
      service.completeJson({
        system: 'sys',
        user: 'user',
        schema: looseSchema,
      }),
    ).rejects.toBeInstanceOf(AiUnavailableError);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.available).toBe(false);
  });

  it('解析模型返回的 JSON，并补齐默认值', async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('{"items":[{"name":"a"}]}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createService().completeJson({
      system: 'sys',
      user: 'user',
      schema: looseSchema,
    });

    expect(result).toEqual({ items: [{ name: 'a' }] });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ai.test/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer test-key',
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'test-model',
      response_format: { type: 'json_object' },
    });
  });

  it('模型用 markdown 代码块包住 JSON 时也能解析', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(completion('```json\n{"items":[{"name":"b"}]}\n```'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createService().completeJson({
      system: 'sys',
      user: 'user',
      schema: looseSchema,
    });

    expect(result).toEqual({ items: [{ name: 'b' }] });
  });

  it('首次上游报错会重试一次并成功', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValueOnce(completion('{"items":[]}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createService().completeJson({
      system: 'sys',
      user: 'user',
      schema: looseSchema,
    });

    expect(result).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('返回结构与约定不符时抛 AiUnavailableError，并指出出错字段', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(completion('{"items":[{"label":"a"}]}')),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await createService()
      .completeJson({ system: 'sys', user: 'user', schema: strictSchema })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiUnavailableError);
    expect((error as Error).message).toContain('items.0.name');
    // 重试后仍然不合约定 → 一共调用两次
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
