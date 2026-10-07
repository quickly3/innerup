import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ZodType } from 'zod';

import { AiUnavailableError } from './ai.errors.js';

/** 一次「要求模型返回 JSON，再用 Zod 二次校验」的调用参数。 */
export interface JsonCompletionOptions<T> {
  /** 系统提示词（集中放在 `src/ai/prompts/*`，见《项目规划》第 8.2 节）。 */
  system: string;
  /** 本次的用户输入。调用方负责**不要**把原文写进日志。 */
  user: string;
  /** 结构化输出契约；模型返回的 JSON 必须能通过它（第 8.2 节：结构化输出 + Zod 二次校验）。 */
  schema: ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_TEMPERATURE = 0.2;
/** 上游抖动 / 输出跑偏时重试一次即可，避免单次请求长时间挂起。 */
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 600;

/**
 * AI 服务：对外只暴露「给提示词、拿结构化对象」这一件事。
 *
 * - 走 **OpenAI 兼容**的 `/chat/completions`，因此换 provider 只改环境变量
 *   （`AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY`，见《项目规划》第 8.3 节）。
 * - 只返回**通过 Zod 校验**的结果；任何一步失败都抛 `AiUnavailableError`，
 *   让业务层降级，而不是把半成品数据写进库。
 * - 不依赖任何 SDK，用 Node 内置 `fetch`，少一层依赖。
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  /** 是否配置了 API Key。未配置时直接降级，不必等请求超时。 */
  get available(): boolean {
    return this.resolveApiKey().length > 0;
  }

  async completeJson<T>(options: JsonCompletionOptions<T>): Promise<T> {
    if (!this.available) {
      throw new AiUnavailableError(
        '未配置 AI_API_KEY，无法调用 AI（请在 be/.env 中填写后重启后端）',
      );
    }

    let lastError: unknown;
    let lastAiError: AiUnavailableError | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const content = await this.requestJsonText(options);
        const result = options.schema.safeParse(parseJsonLoose(content));

        if (!result.success) {
          const detail = result.error.issues
            .slice(0, 2)
            .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('; ');
          throw new AiUnavailableError(`AI 返回的结构不符合约定（${detail}）`);
        }

        return result.data;
      } catch (error) {
        lastError = error;

        if (error instanceof AiUnavailableError) {
          lastAiError = error;
        }

        this.logger.warn(
          `AI 调用第 ${attempt}/${MAX_ATTEMPTS} 次失败：${describeError(error)}`,
        );

        if (attempt < MAX_ATTEMPTS) {
          await delay(RETRY_DELAY_MS);
        }
      }
    }

    // 优先抛出信息量最大的那次失败（例如结构不符会指出是哪个字段）
    throw (
      lastAiError ??
      new AiUnavailableError('AI 暂时不可用，请稍后重试或改为手动新增', {
        cause: lastError,
      })
    );
  }

  private async requestJsonText<T>(
    options: JsonCompletionOptions<T>,
  ): Promise<string> {
    const { baseUrl, apiKey, model } = this.resolveProvider();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    let response: Response;

    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: options.system },
            { role: 'user', content: options.user },
          ],
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
          max_tokens: options.maxTokens,
          // 原生 JSON 模式：不让模型自由发挥成 markdown
          response_format: { type: 'json_object' },
          stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new AiUnavailableError(
        describeError(error) === 'timeout'
          ? `AI 请求超时（>${timeoutMs} ms）`
          : `AI 请求失败：${describeError(error)}`,
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new AiUnavailableError(
        `AI 上游返回 ${response.status}${await readErrorDetail(response)}`,
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AiUnavailableError('AI 返回内容为空');
    }

    return content;
  }

  private resolveProvider(): {
    baseUrl: string;
    apiKey: string;
    model: string;
  } {
    const baseUrl =
      this.config.get<string>('AI_BASE_URL')?.trim() || DEFAULT_BASE_URL;
    const model = this.config.get<string>('AI_MODEL')?.trim() || DEFAULT_MODEL;

    return {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey: this.resolveApiKey(),
      model,
    };
  }

  private resolveApiKey(): string {
    return this.config.get<string>('AI_API_KEY')?.trim() ?? '';
  }
}

/** 模型偶尔会无视 JSON 模式包一层 markdown 或前后加话，这里尽量兜住。 */
function parseJsonLoose(raw: string): unknown {
  const text = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (error) {
        throw new AiUnavailableError('AI 返回的不是合法 JSON', { cause: error });
      }
    }

    throw new AiUnavailableError('AI 返回的不是合法 JSON');
  }
}

/** 上游错误体只截一小段用于排查；不会包含我们发给模型的用户原文。 */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.text()).replace(/\s+/g, ' ').trim();
    return body.length > 0 ? `：${body.slice(0, 200)}` : '';
  } catch {
    return '';
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    // AbortSignal.timeout 触发时是 TimeoutError，单独给一句更好懂的提示
    return error.name === 'TimeoutError' ? 'timeout' : error.message;
  }
  return String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
