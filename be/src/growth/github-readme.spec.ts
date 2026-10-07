import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { GITHUB_MAX_REPOS_NO_TOKEN } from './growth.constants.js';
import { cleanReadme, composeGithubText } from './github-readme.text.js';
import { GithubReadmeService } from './github-readme.service.js';
import type {
  GithubRepoDoc,
  GithubTarget,
  GithubUserProfile,
} from './github-readme.types.js';

const TARGET: GithubTarget = { owner: 'me', repo: null, display: 'me' };

const PROFILE: GithubUserProfile = {
  login: 'me',
  name: '张三',
  bio: '后端工程师，最近在学 Rust',
  company: '@acme',
  location: 'Chengdu',
  blog: 'https://example.com',
  twitter: 'zhangsan',
  hireable: true,
  publicRepos: 12,
  followers: 30,
  following: 8,
  joinedAt: '2015-03',
};

function userPayload(extra: Record<string, unknown> = {}) {
  return {
    login: 'me',
    name: '张三',
    bio: '后端工程师，最近在学 Rust',
    company: '@acme',
    location: 'Chengdu',
    blog: 'https://example.com',
    twitter_username: 'zhangsan',
    hireable: true,
    public_repos: 12,
    followers: 30,
    following: 8,
    created_at: '2015-03-01T00:00:00Z',
    ...extra,
  };
}

function doc(
  fullName: string,
  readme: string,
  extra: Partial<GithubRepoDoc> = {},
): GithubRepoDoc {
  return {
    fullName,
    name: fullName.split('/')[1],
    description: null,
    language: null,
    topics: [],
    stars: 0,
    readme,
    ...extra,
  };
}

function createService(env: Record<string, string> = {}): GithubReadmeService {
  return new GithubReadmeService(new ConfigService({ GITHUB_TOKEN: '', ...env }));
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function repoPayload(name: string, extra: Record<string, unknown> = {}) {
  return { name, full_name: `me/${name}`, fork: false, ...extra };
}

/** fetch 的桩：url 一律当字符串处理，省掉类型断言与重复的 stubGlobal。 */
type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

function stubFetch(handler: FetchHandler): Mock<FetchHandler> {
  const mock = vi.fn<FetchHandler>(handler);
  vi.stubGlobal('fetch', mock);

  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cleanReadme', () => {
  it('洗掉徽章、HTML 注释与链接地址，保留正文', () => {
    const raw = [
      '[![Build](https://img.shields.io/badge.svg)](https://github.com/actions)',
      '<!-- 这是注释 -->',
      '',
      '# 项目',
      '',
      '看[在线文档](https://example.com/docs)开始。',
      '',
      '',
      '## 用法',
    ].join('\n');

    const cleaned = cleanReadme(raw);

    expect(cleaned).not.toContain('shields.io');
    expect(cleaned).not.toContain('<!--');
    expect(cleaned).not.toContain('example.com');
    expect(cleaned).toContain('看在线文档开始。');
    expect(cleaned).not.toContain('\n\n\n');
  });
});

describe('composeGithubText', () => {
  it('带资料卡与仓库元信息，且总长不超过预算', () => {
    const docs = [
      doc('me/alpha', '正文'.repeat(40), { description: '示例项目', stars: 12 }),
      doc('me/beta', 'bbb', { stars: 300 }),
    ];

    const composed = composeGithubText(TARGET, PROFILE, docs, 10_000);

    expect(composed.text).toContain('## GitHub：me');
    expect(composed.text).toContain('### 资料卡：me');
    expect(composed.text).toContain('姓名：张三');
    expect(composed.text).toContain('简介：后端工程师，最近在学 Rust');
    expect(composed.text).toContain('Twitter：@zhangsan');
    expect(composed.text).toContain('加入于 2015-03');
    expect(composed.text).toContain('状态：正在找工作');
    // 代表作按 Star 排：beta 应该排在 alpha 前面
    expect(composed.text).toContain('代表作（按 Star）：me/beta（★300）、me/alpha（★12）');
    expect(composed.text).toContain('### 仓库：me/alpha');
    expect(composed.text).toContain('简介：示例项目');
    expect(composed.repos.map((repo) => repo.fullName)).toEqual(['me/alpha', 'me/beta']);
    expect(composed.truncated).toBe(false);
  });

  it('资料卡读不到时照样能拼出文本', () => {
    const composed = composeGithubText(TARGET, null, [doc('me/alpha', '正文')], 10_000);

    expect(composed.text).toContain('## GitHub：me');
    expect(composed.text).not.toContain('### 资料卡');
    expect(composed.text).toContain('### 仓库：me/alpha');
  });

  it('资料卡里的换行被压平，避免撑坏提示词结构', () => {
    const composed = composeGithubText(
      TARGET,
      { ...PROFILE, bio: '第一行\n\n第二行' },
      [],
      10_000,
    );

    expect(composed.text).toContain('简介：第一行 第二行');
  });

  it('预算用完就停下并标记截断，不会把每个仓库都切碎', () => {
    const docs = [
      doc('me/alpha', 'a'.repeat(400)),
      doc('me/beta', 'b'.repeat(400)),
      doc('me/gamma', 'c'.repeat(400)),
    ];

    const composed = composeGithubText(TARGET, PROFILE, docs, 600);

    expect(composed.text.length).toBeLessThanOrEqual(600);
    expect(composed.repos.map((repo) => repo.fullName)).toEqual(['me/alpha']);
    expect(composed.truncated).toBe(true);
  });
});

describe('GithubReadmeService', () => {
  it('解析不出地址时直接 400，不发任何请求', async () => {
    const fetchMock = stubFetch(async () => json({}));

    await expect(createService().fetchReadmes('https://gitlab.com/me')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('用户不存在时抛 404', async () => {
    stubFetch(async () => json({ message: 'Not Found' }, 404));

    await expect(createService().fetchReadmes('me')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('读账号资料卡 + 公开仓库 README，跳过没有 README 的仓库', async () => {
    stubFetch(async (url) => {
      if (url.endsWith('/users/me')) {
        return json(userPayload());
      }

      if (url.includes('/users/me/repos')) {
        return json([
          repoPayload('alpha', {
            description: '数据看板',
            language: 'TypeScript',
            topics: ['vue'],
            stargazers_count: 42,
          }),
          repoPayload('beta'),
        ]);
      }

      if (url.includes('/repos/me/alpha/readme')) {
        return new Response('# alpha\n一个数据看板项目，用 Vue 写的。');
      }

      return json({ message: 'Not Found' }, 404);
    });

    const bundle = await createService().fetchReadmes('https://github.com/me');

    expect(bundle.target).toEqual({ owner: 'me', repo: null, display: 'me' });
    expect(bundle.profile?.name).toBe('张三');
    expect(bundle.profile?.joinedAt).toBe('2015-03');
    expect(bundle.repos.map((repo) => repo.fullName)).toEqual(['me/alpha']);
    expect(bundle.totalRepos).toBe(2);
    expect(bundle.skipped).toBe(1);
    expect(bundle.text).toContain('### 资料卡：me');
    expect(bundle.text).toContain('简介：后端工程师，最近在学 Rust');
    expect(bundle.text).toContain('代表作（按 Star）：me/alpha（★42）');
    expect(bundle.text).toContain('数据看板');
    expect(bundle.text).toContain('Vue');
  });

  it('资料卡读不到（限流 / 抖动）不影响 README 分析', async () => {
    stubFetch(async (url) => {
      if (url.endsWith('/users/me')) {
        return json({ message: 'API rate limit exceeded' }, 403, {
          'x-ratelimit-remaining': '0',
        });
      }

      return url.includes('/users/me/repos')
        ? json([repoPayload('alpha')])
        : new Response('# alpha');
    });

    const bundle = await createService().fetchReadmes('me');

    expect(bundle.profile).toBeNull();
    expect(bundle.repos.map((repo) => repo.fullName)).toEqual(['me/alpha']);
    expect(bundle.text).not.toContain('### 资料卡');
  });

  it('过滤 fork，且未配置 GITHUB_TOKEN 时最多读 6 个仓库', async () => {
    const repos = Array.from({ length: 9 }, (_, index) => repoPayload(`repo${index}`));
    repos.unshift(repoPayload('forked', { fork: true }));

    const fetchMock = stubFetch(async (url) => {
      if (url.endsWith('/users/me')) {
        return json(userPayload());
      }

      return url.includes('/users/me/repos') ? json(repos) : new Response(`# ${url}`);
    });

    const bundle = await createService().fetchReadmes('me');
    const readmeCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/readme'));

    expect(bundle.totalRepos).toBe(GITHUB_MAX_REPOS_NO_TOKEN);
    expect(bundle.repos).toHaveLength(GITHUB_MAX_REPOS_NO_TOKEN);
    expect(readmeCalls).toHaveLength(GITHUB_MAX_REPOS_NO_TOKEN);
    expect(bundle.text).not.toContain('me/forked');
  });

  it('单个仓库地址只读那一个仓库', async () => {
    const fetchMock = stubFetch(async (url) => {
      if (url.endsWith('/users/me')) {
        return json(userPayload());
      }
      if (url.endsWith('/readme')) {
        return new Response('# alpha');
      }
      if (url.includes('/repos/me/alpha')) {
        return json(repoPayload('alpha'));
      }

      return json({ message: 'Not Found' }, 404);
    });

    const bundle = await createService().fetchReadmes('https://github.com/me/alpha');

    expect(bundle.target.display).toBe('me/alpha');
    expect(bundle.repos.map((repo) => repo.fullName)).toEqual(['me/alpha']);
    // 仓库模式也要带上账号资料卡，但**不**去拉仓库列表
    expect(bundle.profile?.name).toBe('张三');
    expect(bundle.text).toContain('### 资料卡：me');
    expect(fetchMock.mock.calls.every(([url]) => !url.includes('/users/me/repos'))).toBe(true);
  });

  it('额度用完时抛 503，交给前端降级', async () => {
    stubFetch(async (url) =>
      url.includes('/users/me/repos')
        ? json([repoPayload('alpha')])
        : json({ message: 'API rate limit exceeded' }, 403, {
            'x-ratelimit-remaining': '0',
          }),
    );

    await expect(createService().fetchReadmes('me')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('仓库都没有 README 时提示改用手动录入', async () => {
    stubFetch(async (url) =>
      url.includes('/users/me/repos')
        ? json([repoPayload('alpha')])
        : json({ message: 'Not Found' }, 404),
    );

    await expect(createService().fetchReadmes('me')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('token 无效（401）时自动退回未认证请求，不让整次录入失败', async () => {
    const authorizations: Array<string | undefined> = [];

    stubFetch(async (url, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      authorizations.push(headers?.['authorization']);

      if (url.endsWith('/users/me')) {
        // 第一次带 token 被拒，第二次不带 token 成功
        return headers?.['authorization']
          ? json({ message: 'Bad credentials' }, 401)
          : json(userPayload());
      }

      return url.includes('/users/me/repos') ? json([repoPayload('alpha')]) : new Response('# a');
    });

    const bundle = await createService({ GITHUB_TOKEN: 'ghp_bad' }).fetchReadmes('me');

    expect(bundle.profile?.login).toBe('me');
    // 资料卡与仓库列表是并发发的，两个都会先撞 401；之后同一次录入里的请求不再带 token
    expect(authorizations.filter((value) => value === 'Bearer ghp_bad')).toHaveLength(2);
    expect(authorizations.filter((value) => value !== undefined)).toHaveLength(2);
  });

  it('token 带了引号或 Bearer 前缀也能用', async () => {
    const authorizations: Array<string | undefined> = [];

    stubFetch(async (url, init) => {
      authorizations.push((init?.headers as Record<string, string> | undefined)?.['authorization']);

      if (url.endsWith('/users/me')) {
        return json(userPayload());
      }

      return url.includes('/users/me/repos') ? json([repoPayload('alpha')]) : new Response('# a');
    });

    await createService({ GITHUB_TOKEN: ' "Bearer ghp_ok" ' }).fetchReadmes('me');

    expect(authorizations.every((value) => value === 'Bearer ghp_ok')).toBe(true);
  });

  it('未配置 token 时遇到 401，给出可排查的提示', async () => {
    stubFetch(async () => json({ message: 'Bad credentials' }, 401));

    await expect(createService().fetchReadmes('me')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('配置了 GITHUB_TOKEN 时带上 Authorization，且上限放宽到 12 个', async () => {
    const repos = Array.from({ length: 20 }, (_, index) => repoPayload(`repo${index}`));
    const authorizations: unknown[] = [];

    stubFetch(async (url, init) => {
      const headers = init?.headers as Record<string, string> | undefined;

      if (url.endsWith('/users/me')) {
        authorizations.push(headers?.['authorization']);

        return json(userPayload());
      }

      if (url.includes('/users/me/repos')) {
        return json(repos);
      }

      authorizations.push(headers?.['authorization']);

      return new Response(`# ${url}`);
    });

    const bundle = await createService({ GITHUB_TOKEN: 't0ken' }).fetchReadmes('me');

    expect(bundle.repos).toHaveLength(12);
    expect(bundle.repos.map((repo) => repo.fullName)).toContain('me/repo11');
    expect(bundle.profile?.login).toBe('me');
    expect(authorizations.length).toBe(13);
    expect(authorizations.every((value) => value === 'Bearer t0ken')).toBe(true);
  });
});
