import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AiUnavailableError } from '../ai/ai.errors.js';
import { AiService } from '../ai/ai.service.js';
import {
  buildMapGithubUserPrompt,
  buildMapIngestUserPrompt,
  MAP_GITHUB_INGEST_SYSTEM_PROMPT,
  MAP_INGEST_SYSTEM_PROMPT,
  type ExistingMapSummary,
} from '../ai/prompts/map-ingest.prompt.js';
import {
  mapIngestResultSchema,
} from '../ai/schemas/map-ingest.schema.js';
import {
  MAX_INGEST_CHARS,
  MAX_PDF_BYTES,
  MIN_INGEST_CHARS,
  PDF_MIME_TYPE,
} from './growth.constants.js';
import { GithubReadmeService } from './github-readme.service.js';
import { GrowthService } from './growth.service.js';
import { extractPdfText } from './pdf-text.js';
import type { IngestResult, UploadedPdfFile } from './map-ingest.types.js';

/**
 * 「文本 / PDF / GitHub → AI 归类」链路（《项目规划》第 13.9 节）。
 *
 * 三种输入只在前半段不同（抽文本），后半段共用同一个 `classify`：
 * 只返回候选、**不落库**，用户改 / 删 / 换类之后再调 `/api/map/candidates/apply`。
 * AI 失败时抛 503，让前端降级到手动录入，而不是把整个录入流程卡死。
 */
@Injectable()
export class MapIngestService {
  private readonly logger = new Logger(MapIngestService.name);

  constructor(
    private readonly ai: AiService,
    private readonly growth: GrowthService,
    private readonly github: GithubReadmeService,
  ) {}

  async ingestText(rawText: string): Promise<IngestResult> {
    const prepared = prepareText(rawText);

    return this.classify(prepared.text, prepared.truncated, (existing) => ({
      system: MAP_INGEST_SYSTEM_PROMPT,
      user: buildMapIngestUserPrompt(prepared.text, existing),
    }));
  }

  async ingestGithub(rawUrl: string): Promise<IngestResult> {
    const bundle = await this.github.fetchReadmes(rawUrl);

    const result = await this.classify(bundle.text, bundle.truncated, (existing) => ({
      system: MAP_GITHUB_INGEST_SYSTEM_PROMPT,
      user: buildMapGithubUserPrompt(bundle.target.display, bundle.text, existing),
    }));

    return {
      candidates: result.candidates,
      meta: {
        ...result.meta,
        github: {
          source: bundle.target.display,
          owner: bundle.target.owner,
          profile: bundle.profile
            ? {
                login: bundle.profile.login,
                name: bundle.profile.name,
                bio: bundle.profile.bio,
              }
            : null,
          repos: bundle.repos.map((repo) => repo.fullName),
          skipped: bundle.skipped,
          totalRepos: bundle.totalRepos,
        },
      },
    };
  }

  async ingestPdf(file: UploadedPdfFile | undefined): Promise<IngestResult> {
    if (!file) {
      throw new BadRequestException('没有收到文件，请选择一份 PDF');
    }
    if (file.mimetype !== PDF_MIME_TYPE) {
      throw new BadRequestException('只支持 PDF 文件');
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new BadRequestException('PDF 不能超过 10MB');
    }

    let extracted: string;

    try {
      extracted = await extractPdfText(file.buffer);
    } catch (error) {
      this.logger.warn(`PDF 解析失败：${describeError(error)}`);
      throw new BadRequestException('这份 PDF 读不出内容，可能已损坏或被加密');
    }

    if (extracted.trim().length < MIN_INGEST_CHARS) {
      throw new BadRequestException(
        '这份 PDF 没有文本层（可能是扫描件），暂不支持 OCR，请直接粘贴文字',
      );
    }

    const prepared = prepareText(extracted);

    return this.classify(prepared.text, prepared.truncated, (existing) => ({
      system: MAP_INGEST_SYSTEM_PROMPT,
      user: buildMapIngestUserPrompt(prepared.text, existing),
    }));
  }

  /** 三种输入共用的后半段：一次 AI 调用 + Zod 校验，失败转 503 让前端降级。 */
  private async classify(
    text: string,
    truncated: boolean,
    buildPrompt: (existing: ExistingMapSummary) => { system: string; user: string },
  ): Promise<IngestResult> {
    const existing = await this.growth.existingSummary();

    try {
      const candidates = await this.ai.completeJson({
        ...buildPrompt(existing),
        schema: mapIngestResultSchema,
        maxTokens: 4000,
      });

      // 只记字数，不记原文（隐私：见《项目规划》第 13.9 节）
      this.logger.log(
        `AI 归类完成：${text.length} 字 → 关注点 ${candidates.focus.length} / 兴趣 ${candidates.interest.length} / 输入 ${candidates.input.length} / 知识 ${candidates.knowledge.length} / 技能 ${candidates.skill.length}`,
      );

      return { candidates, meta: { chars: text.length, truncated } };
    } catch (error) {
      if (error instanceof AiUnavailableError) {
        throw new ServiceUnavailableException(
          `AI 归类失败：${error.message}。可以改用下方的「手动新增」。`,
        );
      }

      throw error;
    }
  }
}

function prepareText(raw: string): { text: string; truncated: boolean } {
  const text = raw.trim();

  if (text.length < MIN_INGEST_CHARS) {
    throw new BadRequestException(
      `内容太少（至少 ${MIN_INGEST_CHARS} 个字），多写几句 AI 才有得归类`,
    );
  }

  if (text.length > MAX_INGEST_CHARS) {
    return { text: text.slice(0, MAX_INGEST_CHARS), truncated: true };
  }

  return { text, truncated: false };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
