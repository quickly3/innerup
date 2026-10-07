import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  GITHUB_API_BASE_URL,
  GITHUB_API_VERSION,
  GITHUB_MAX_README_CHARS,
  GITHUB_MAX_REPOS,
  GITHUB_MAX_REPOS_NO_TOKEN,
  GITHUB_README_CONCURRENCY,
  GITHUB_REPO_FETCH_LIMIT,
  GITHUB_REQUEST_TIMEOUT_MS,
  MAX_INGEST_CHARS,
  MIN_INGEST_CHARS,
} from './growth.constants.js';
import { cleanReadme, composeGithubText } from './github-readme.text.js';
import { parseGithubTarget } from './github-url.js';
import type {
  GithubReadmeBundle,
  GithubRepoDoc,
  GithubRepoPayload,
  GithubUserPayload,
  GithubUserProfile,
} from './github-readme.types.js';

/**
 * GitHub 公开仓库 + 账号资料卡 → 纯文本（《项目规划》第 13.9 / 13.10 节）。
 *
 * 边界（安全 / 成本）：
 * - 用户给的地址只用 `parseGithubTarget` 解析出 `owner` / `repo`，请求一律打到固定的
 *   `https://api.github.com`——**不拿用户输入直接 fetch**，从根上避免 SSRF；
 * - 只读**公开**仓库与**公开**资料卡；`GITHUB_TOKEN` 是可选的、只留在后端，仅用来抬高限额；
 * - 仓库数、单个 README 字数、总字数都有上限（见 `growth.constants.ts`）；
 * - 日志只记仓库名与字数，不打印 README 原文。
 */
@Injectable()
export class GithubReadmeService implements OnModuleInit {
  private readonly logger = new Logger(GithubReadmeService.name);
  /** 一旦发现 token 被拒就置 false：后面直接用未认证请求，不再白试。 */
  private useToken = true;

  constructor(private readonly config: ConfigService) {}

  /**
   * 启动时说清楚 token 有没有被读到（脱敏）。
   * 「配置了但没生效」几乎都是忘了重启，或值被引号 / 空格污染。
   */
  onModuleInit(): void {
    const token = this.resolveToken();

    this.logger.log(
      token
        ? `GITHUB_TOKEN 已配置（${maskToken(token)}），GitHub 限额 5000 次/小时`
        : 'GITHUB_TOKEN 未配置，GitHub 按未认证处理（60 次/小时，最多读 6 个仓库）',
    );
  }

  async fetchReadmes(rawInput: string): Promise<GithubReadmeBundle> {
    const target = parseGithubTarget(rawInput);
    const maxRepos = this.hasToken() ? GITHUB_MAX_REPOS : GITHUB_MAX_REPOS_NO_TOKEN;

    const [profile, repos] = await Promise.all([
      this.fetchProfile(target.owner),
      target.repo
        ? this.fetchRepoRows(target.owner, target.repo, target.display)
        : this.fetchOwnerRepos(target.owner, maxRepos),
    ]);

    if (repos.length === 0) {
      throw new NotFoundException(
        `@${target.owner} 名下没有找到公开仓库（fork 不算），换成手动粘贴吧`,
      );
    }

    let firstError: unknown = null;

    const fetched = await mapWithConcurrency(
      repos,
      GITHUB_README_CONCURRENCY,
      async (repo) => {
        try {
          const raw = await this.fetchReadme(target.owner, repo.name);
          return raw === null
            ? null
            : {
                ...repo,
                readme: cleanReadme(raw).slice(0, GITHUB_MAX_README_CHARS),
              };
        } catch (error) {
          // 单个仓库读失败（限流 / 抖动）不该废掉整次录入，先记下来继续做别的
          firstError ??= error;
          return null;
        }
      },
    );

    const docs = fetched.filter((doc): doc is GithubRepoDoc => doc !== null);

    // 有资料卡时就算一个仓库 README 都没有，也还有得归类，所以门槛放到后面统一判断
    if (docs.length === 0 && !profile) {
      if (firstError instanceof HttpException) {
        throw firstError;
      }

      throw new BadRequestException(
        `${target.display} 的仓库里都没有 README，改成手动粘贴或传 PDF 吧`,
      );
    }

    const composed = composeGithubText(target, profile, docs, MAX_INGEST_CHARS);
    const bundle: GithubReadmeBundle = {
      target,
      profile,
      text: composed.text,
      repos: composed.repos,
      skipped: repos.length - docs.length,
      totalRepos: repos.length,
      truncated: composed.truncated,
    };

    if (bundle.text.length < MIN_INGEST_CHARS) {
      throw new BadRequestException(
        '这些 README 内容太少，AI 没什么可归类的，改成手动粘贴吧',
      );
    }

    // 只记仓库名与字数（README 是公开内容，但也没必要进日志）
    this.logger.log(
      `GitHub 读取完成：${target.display} → 资料卡${profile ? '✓' : '✗'}、${bundle.repos.length}/${bundle.totalRepos} 个仓库有 README，共 ${bundle.text.length} 字`,
    );

    return bundle;
  }

  /**
   * overview 资料卡（姓名 / 简介 / 公司 / 地点 / 主页 / 社交 / 统计）。
   *
   * 读不到不影响主流程：资料卡只是加分项，README 才是主料。
   */
  private async fetchProfile(owner: string): Promise<GithubUserProfile | null> {
    try {
      const response = await this.request(`/users/${encodeURIComponent(owner)}`);

      return response.status === 404
        ? null
        : toUserProfile((await response.json()) as GithubUserPayload, owner);
    } catch (error) {
      this.logger.warn(`读取 ${owner} 的资料卡失败：${describeError(error)}`);

      return null;
    }
  }

  /** 按「最近推送」取前 N 个非 fork 仓库。 */
  private async fetchOwnerRepos(
    owner: string,
    maxRepos: number,
  ): Promise<GithubRepoDoc[]> {
    const query = new URLSearchParams({
      per_page: String(GITHUB_REPO_FETCH_LIMIT),
      sort: 'pushed',
      direction: 'desc',
      type: 'owner',
    });
    const response = await this.request(
      `/users/${encodeURIComponent(owner)}/repos?${query.toString()}`,
    );

    if (response.status === 404) {
      throw new NotFoundException(`找不到 GitHub 用户 ${owner}，检查一下地址拼写`);
    }

    const payload = (await response.json()) as unknown;

    if (!Array.isArray(payload)) {
      return [];
    }

    return (payload as GithubRepoPayload[])
      .filter((repo) => repo.fork !== true && readText(repo.name) !== null)
      .slice(0, maxRepos)
      .map((repo) => {
        const name = readText(repo.name) ?? '';

        return toRepoDoc(repo, `${owner}/${name}`);
      });
  }

  private async fetchRepoRows(
    owner: string,
    repo: string,
    display: string,
  ): Promise<GithubRepoDoc[]> {
    const response = await this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    );

    if (response.status === 404) {
      throw new NotFoundException(
        `找不到公开仓库 ${display}，检查拼写，或它不是一个公开仓库`,
      );
    }

    return [toRepoDoc((await response.json()) as GithubRepoPayload, display)];
  }

  /** 返回 `null` 表示这个仓库没有 README（404），不算错误。 */
  private async fetchReadme(owner: string, repo: string): Promise<string | null> {
    const response = await this.request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
      'application/vnd.github.raw',
    );

    return response.status === 404 ? null : response.text();
  }

  /**
   * 发一次 GitHub API 请求。
   *
   * - 网络层失败 / 限流 / 5xx 统一转成 503，让前端降级到手动录入；
   * - 404 原样返回，由调用方决定是「报错」还是「这个仓库没有 README」；
   * - **401 会自动降级**：token 过期 / 复制不全时不再死给用户看，改走未认证
   *   （额度 60 次/小时）并留一条 warn，进程内只降级一次，不会每个请求都白试一遍。
   */
  private async request(path: string, accept = 'application/vnd.github+json'): Promise<Response> {
    const headers: Record<string, string> = {
      accept,
      'user-agent': 'InnerUp',
      'x-github-api-version': GITHUB_API_VERSION,
    };
    const token = this.useToken ? this.resolveToken() : '';

    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }

    let response: Response;

    try {
      response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
        headers,
        signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `连不上 GitHub：${describeError(error)}。可以改用下方的「手动新增」`,
      );
    }

    if (response.status === 401 && token) {
      // token 无效：别让整次录入废掉，退回未认证重试一次，并停用这个 token
      this.useToken = false;
      this.logger.warn(
        `GITHUB_TOKEN 无效（401 Bad credentials），已退回未认证请求（额度 60 次/小时）。` +
          `请到 https://github.com/settings/tokens 重新生成 ${maskToken(token)}，填进 be/.env 后重启后端`,
      );

      return this.request(path, accept);
    }

    if (response.ok || response.status === 404) {
      return response;
    }

    const detail = await readGithubError(response);

    if (response.status === 401) {
      throw new ServiceUnavailableException(
        `GitHub 拒绝了这次请求（401${detail}）。若配置了 GITHUB_TOKEN，请检查它是否已过期或被撤销`,
      );
    }

    if (response.status === 403 || response.status === 429) {
      const exhausted =
        response.headers.get('x-ratelimit-remaining') === '0'
          ? '，本小时额度已用完'
          : '';

      throw new ServiceUnavailableException(
        `GitHub 拒绝了这次请求（${response.status}${exhausted}${detail}）。稍后再试，或在 be/.env 配置 GITHUB_TOKEN 抬高限额`,
      );
    }

    throw new ServiceUnavailableException(`GitHub 返回 ${response.status}${detail}`);
  }

  private hasToken(): boolean {
    return this.useToken && this.resolveToken().length > 0;
  }

  /** 容忍常见的复制错误：带引号、带 `Bearer ` 前缀、前后有空格。 */
  private resolveToken(): string {
    const raw = this.config.get<string>('GITHUB_TOKEN')?.trim() ?? '';

    return raw
      .replace(/^["']|["']$/g, '')
      .replace(/^(?:bearer|token)\s+/i, '')
      .trim();
  }
}

/** 日志里只出现前 4 位与后 4 位，够定位是哪条 token，又不至于泄露。 */
function maskToken(token: string): string {
  return token.length <= 8 ? '***' : `${token.slice(0, 4)}…${token.slice(-4)}`;
}

/** 并发跑 `limit` 条，结果顺序与 `items` 一致。 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = Array.from<R>({ length: items.length });
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);

  return results;
}

function toRepoDoc(payload: GithubRepoPayload, fallbackFullName: string): GithubRepoDoc {
  const fullName = readText(payload.full_name) ?? fallbackFullName;

  return {
    fullName,
    name: readText(payload.name) ?? fullName.split('/').pop() ?? fullName,
    description: readText(payload.description),
    language: readText(payload.language),
    topics: Array.isArray(payload.topics)
      ? payload.topics.filter((topic) => typeof topic === 'string').slice(0, 6)
      : [],
    stars: typeof payload.stargazers_count === 'number' ? payload.stargazers_count : 0,
    readme: '',
  };
}

function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** 资料卡字段经常带换行 / 多个空格，压成一行才好塞进提示词。 */
function readInlineText(value: unknown, max: number): string | null {
  const text = readText(value);

  if (!text) {
    return null;
  }

  return text.replace(/\s+/g, ' ').slice(0, max);
}

function toUserProfile(payload: GithubUserPayload, fallbackLogin: string): GithubUserProfile {
  return {
    login: readText(payload.login) ?? fallbackLogin,
    name: readInlineText(payload.name, 80),
    bio: readInlineText(payload.bio, 300),
    company: readInlineText(payload.company, 80),
    location: readInlineText(payload.location, 80),
    blog: readInlineText(payload.blog, 120),
    twitter: readInlineText(payload.twitter_username, 60),
    hireable: typeof payload.hireable === 'boolean' ? payload.hireable : null,
    publicRepos: toCount(payload.public_repos),
    followers: toCount(payload.followers),
    following: toCount(payload.following),
    joinedAt: readText(payload.created_at)?.slice(0, 7) ?? null,
  };
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** 上游错误体里 GitHub 会给一句 `message`，只截一小段用于排查。 */
async function readGithubError(response: Response): Promise<string> {
  try {
    const body = await response.text();

    try {
      const parsed = JSON.parse(body) as { message?: unknown };
      const message = readText(parsed.message);

      if (message) {
        return `：${message.slice(0, 160)}`;
      }
    } catch {
      // 不是 JSON 就走下面的兜底
    }

    const text = body.replace(/\s+/g, ' ').trim();

    return text.length > 0 ? `：${text.slice(0, 160)}` : '';
  } catch {
    return '';
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? '请求超时' : error.message;
  }

  return String(error);
}
