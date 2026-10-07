import type {
  GithubComposeResult,
  GithubRepoDoc,
  GithubRepoNote,
  GithubTarget,
  GithubUserProfile,
} from './github-readme.types.js';

/**
 * 「资料卡 + README」→ 提示词文本的纯函数（《项目规划》第 13.9 / 13.10 节）。
 *
 * 抽出来单独放，一是好测，二是「怎么剪」直接影响 AI 归类质量，值得单独调。
 */

/** 单个仓库至少要留出这么多字，否则不纳入（免得只剩个标题没有信息）。 */
const MIN_BLOCK_BUDGET = 200;

/** 资料卡里列出多少个「代表作」（按 Star 排）。 */
const TOP_SKILLED_REPOS = 3;

/** 截断标记本身也占字数，算预算时要把它扣掉，否则会撑破上限。 */
const TRUNCATION_SUFFIX = '…（已截断）';

/**
 * 洗掉 README 里对「了解这个人」没用的噪音：
 * YAML frontmatter / badge / 图片 / HTML 注释 / 引用式链接定义 / 链接地址（保留链接文字）。
 * 代码块保留——技术栈就藏在里面。
 */
export function cleanReadme(raw: string): string {
  const withoutFrontmatter = stripFrontmatter(raw.replace(/\r\n/g, '\n'));

  return dropEmptyHeadings(
    withoutFrontmatter
      .replace(/<!--[\s\S]*?-->/g, '')
      // 带链接的徽章：[![CI](badge.svg)](https://actions)
      .replace(/^\s*\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)\s*$/gm, '')
      // 纯图片行（徽章、截图）
      .replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*$/gm, '')
      // 引用式链接定义：[circleci-image]: https://img.shields.io/...
      .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

/** 去掉开头的 YAML frontmatter（`---\nkey: value\n---`），它不是给人读的内容。 */
function stripFrontmatter(text: string): string {
  return text.replace(/^\s*---\n[\s\S]*?\n---\n?/, '');
}

/**
 * 去掉「小标题底下什么都没有」的标题。
 *
 * badge 墙（`#### Main Lan` + 一堆 shields.io 图片）被洗掉后就只剩标题，
 * 既占预算又会让模型以为这里有内容——这类空标题直接删。
 */
function dropEmptyHeadings(text: string): string {
  const lines = text.split('\n');
  const kept: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^#{1,6}\s/.test(line.trim()) && nextContentIsHeading(lines, index + 1)) {
      continue;
    }

    kept.push(line);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function nextContentIsHeading(lines: readonly string[], from: number): boolean {
  for (let index = from; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (line.length === 0) {
      continue;
    }

    return /^#{1,6}\s/.test(line);
  }

  return true;
}

/**
 * 把账号资料卡与若干仓库的 README 拼成一份文本，总长不超过 `budget`。
 *
 * 顺序即优先级：
 * 1. 资料卡（信息密度最高）
 * 2. **Profile README**（`owner/owner` 那个特殊仓库）——它是账号的自我说明书，必须排在最前，
 *    否则会被「按最近推送」的顺序挤到后面、拿不到预算（这正是「没解析出 profile README」的原因）
 * 3. 其余仓库按调用方给的顺序（最近推送），预算用完后面直接不纳入（而不是把每个都切碎）
 */
export function composeGithubText(
  target: GithubTarget,
  profile: GithubUserProfile | null,
  repos: readonly GithubRepoDoc[],
  budget: number,
): GithubComposeResult {
  const docs = orderByValue(target, repos);
  const parts: string[] = [
    [
      `## GitHub：${target.display}`,
      '下面是这个账号的公开资料卡与仓库 README 摘录，用来了解这个人做过什么、懂什么。',
    ].join('\n'),
  ];

  const profileBlock = renderProfileBlock(profile, docs);

  if (profileBlock) {
    parts.push(profileBlock);
  }

  const notes: GithubRepoNote[] = [];
  let used = joinedLength(parts);
  let truncated = false;

  for (const doc of docs) {
    const head = renderRepoHead(doc, target);
    const available = budget - used - head.length - 2;

    if (available < MIN_BLOCK_BUDGET) {
      truncated = true;
      break;
    }

    const cut = doc.readme.length > available;
    const readme = cut
      ? `${doc.readme.slice(0, available - TRUNCATION_SUFFIX.length)}${TRUNCATION_SUFFIX}`
      : doc.readme;
    const block = `${head}${readme}`;

    parts.push(block);
    notes.push({ fullName: doc.fullName, chars: block.length });
    used = joinedLength(parts);

    if (cut) {
      truncated = true;
      break;
    }
  }

  return { text: parts.join('\n\n'), repos: notes, truncated };
}

/** 按 `\n\n` 拼接后的长度（预算按最终文本算，才不会被分隔符偷偷撑破）。 */
function joinedLength(parts: readonly string[]): number {
  return parts.reduce((total, part) => total + part.length, 0) + (parts.length - 1) * 2;
}

/**
 * 把 Profile README（`owner/owner`）提到最前。
 *
 * GitHub 约定「仓库名 = 用户名」的仓库内容是账号主页的自述，信息密度远高于普通项目 README；
 * 按「最近推送」排序时它常排在第 4、5 位，预算被前面吃掉后就轮不到它了。
 */
function orderByValue(
  target: GithubTarget,
  repos: readonly GithubRepoDoc[],
): GithubRepoDoc[] {
  const profileRepo = `${target.owner}/${target.owner}`.toLowerCase();

  return [...repos].sort((left, right) => {
    const leftIsProfile = left.fullName.toLowerCase() === profileRepo ? 1 : 0;
    const rightIsProfile = right.fullName.toLowerCase() === profileRepo ? 1 : 0;

    return rightIsProfile - leftIsProfile;
  });
}

/**
 * 资料卡字段经常带换行 / 连续空格；提示词靠 `### 标题` 分层，
 * 这里统一压成一行，免得第三方内容把结构撑坏。
 */
function inline(value: string | null, max: number): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();

  return text ? text.slice(0, max) : null;
}

/**
 * 账号资料卡（overview 页左侧那块）：姓名 / 简介 / 公司 / 地点 / 主页 / 社交 / 统计。
 *
 * 顺带给出「代表作」——GitHub 的**置顶仓库（Pinned）只有 GraphQL 能读到**，
 * 这里用「Star 最高的几个仓库」近似，够用来判断他擅长什么。
 */
function renderProfileBlock(
  profile: GithubUserProfile | null,
  docs: readonly GithubRepoDoc[],
): string {
  if (!profile) {
    return '';
  }

  const lines: string[] = [`### 资料卡：${profile.login}`];
  const facts: Array<[string, string | null]> = [
    ['姓名', inline(profile.name, 80)],
    ['简介', inline(profile.bio, 300)],
    ['公司', inline(profile.company, 80)],
    ['地点', inline(profile.location, 80)],
    ['主页', inline(profile.blog, 120)],
    ['Twitter', profile.twitter ? `@${inline(profile.twitter, 60) ?? ''}` : null],
  ];

  for (const [label, value] of facts) {
    if (value) {
      lines.push(`- ${label}：${value}`);
    }
  }

  const stats = [`公开仓库 ${profile.publicRepos}`];
  if (profile.followers > 0) stats.push(`关注者 ${profile.followers}`);
  if (profile.following > 0) stats.push(`在关注 ${profile.following}`);
  if (profile.joinedAt) stats.push(`加入于 ${profile.joinedAt}`);
  if (profile.hireable) stats.push('状态：正在找工作');
  lines.push(`- ${stats.join(' ｜ ')}`);

  const notable = [...docs]
    .filter((doc) => doc.stars > 0)
    .sort((left, right) => right.stars - left.stars)
    .slice(0, TOP_SKILLED_REPOS);

  if (notable.length > 0) {
    lines.push(
      `- 代表作（按 Star）：${notable
        .map((doc) => `${doc.fullName}（★${doc.stars}）`)
        .join('、')}`,
    );
  }

  return lines.join('\n');
}

function renderRepoHead(doc: GithubRepoDoc, target: GithubTarget): string {
  const facts: string[] = [];
  const isProfileReadme = doc.fullName.toLowerCase() === `${target.owner}/${target.owner}`.toLowerCase();

  if (doc.description) facts.push(`简介：${doc.description}`);
  if (doc.language) facts.push(`主要语言：${doc.language}`);
  if (doc.stars > 0) facts.push(`Star：${doc.stars}`);
  if (doc.topics.length > 0) facts.push(`Topics：${doc.topics.join('、')}`);

  return [
    `### 仓库：${doc.fullName}${isProfileReadme ? '（账号主页自述 README）' : ''}`,
    facts.join(' ｜ '),
    'README：',
    '',
  ]
    .filter((line) => line.length > 0)
    .join('\n')
    .concat('\n');
}
