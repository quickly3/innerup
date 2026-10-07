import { BadRequestException } from '@nestjs/common';

import type { GithubTarget } from './github-readme.types.js';

/**
 * 解析用户填的 GitHub 地址（《项目规划》第 13.9 节）。
 *
 * 支持的形式：
 * - `https://github.com/yourname`、`https://github.com/yourname/innerup`
 * - `github.com/yourname`、`github.com/yourname/innerup`（省略协议）
 * - `git@github.com:yourname/innerup.git`（SSH 远端）
 * - `yourname`、`yourname/innerup`（裸写法）
 *
 * 只认 github.com，且**只输出 owner / repo**：后续请求一律打到固定的 `api.github.com`，
 * 绝不拿用户给的字符串直接 fetch（防 SSRF）。
 */

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
/** 这些是 GitHub 的功能页路径，不是用户名，单独拦一下给出更好的提示。 */
const RESERVED_PATHS = new Set([
  'about',
  'apps',
  'collections',
  'dashboard',
  'explore',
  'features',
  'issues',
  'login',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'pricing',
  'pulls',
  'search',
  'settings',
  'sponsors',
  'topics',
  'trending',
  'users',
]);

export function parseGithubTarget(raw: string): GithubTarget {
  const input = raw.trim().replace(/^@/, '');

  if (input.length === 0) {
    throw new BadRequestException(
      '请先填 GitHub 地址，例如 https://github.com/yourname',
    );
  }

  const ssh = /^git@github\.com:(?<owner>[^/\s]+)\/(?<repo>[^\s]+)$/.exec(input);

  if (ssh?.groups) {
    return buildTarget(ssh.groups['owner'], ssh.groups['repo']);
  }

  if (/^https?:\/\//i.test(input) || /^(www\.)?github\.com\//i.test(input)) {
    return parseUrlInput(input);
  }

  const segments = input.split('/');

  if (segments.length > 2) {
    throw new BadRequestException(
      '这个地址看不懂，填账号主页或仓库主页就行，例如 https://github.com/yourname/innerup',
    );
  }

  return buildTarget(segments[0], segments[1]);
}

function parseUrlInput(input: string): GithubTarget {
  const url = tryParseUrl(input);

  if (!url || !GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    throw new BadRequestException(
      '只支持 github.com 的地址，例如 https://github.com/yourname',
    );
  }

  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    throw new BadRequestException('这个地址里没有用户名，例如 https://github.com/yourname');
  }

  if (RESERVED_PATHS.has(segments[0].toLowerCase())) {
    throw new BadRequestException(
      '请填 GitHub 账号主页或仓库主页的地址，例如 https://github.com/yourname',
    );
  }

  return buildTarget(segments[0], segments[1]);
}

function buildTarget(rawOwner: string, rawRepo: string | undefined): GithubTarget {
  const owner = rawOwner.trim();
  const repo = stripGitSuffix(rawRepo?.trim() ?? '');

  if (!OWNER_PATTERN.test(owner)) {
    throw new BadRequestException(`认不出 GitHub 用户名「${owner}」，检查一下地址`);
  }

  if (repo.length > 0 && !REPO_PATTERN.test(repo)) {
    throw new BadRequestException(`认不出仓库名「${repo}」，检查一下地址`);
  }

  const name = repo.length > 0 ? repo : null;

  return {
    owner,
    repo: name,
    display: name ? `${owner}/${name}` : owner,
  };
}

function stripGitSuffix(repo: string): string {
  return repo.replace(/\.git$/i, '');
}

function tryParseUrl(input: string): URL | null {
  try {
    return new URL(input.includes('://') ? input : `https://${input}`);
  } catch {
    return null;
  }
}
