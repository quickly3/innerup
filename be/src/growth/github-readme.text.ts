import type {
  GithubComposeResult,
  GithubRepoDoc,
  GithubRepoNote,
  GithubTarget,
  GithubUserProfile,
  ReadmeBadges,
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

/** 无论徽章墙多长，只留前 N 个技术名（长 profile README 的徽章墙能刷出五六十个）。 */
const MAX_BADGE_NAMES = 60;

/**
 * shields.io 静态徽章：`img.shields.io/badge/<内容>-<颜色>`，如 `badge/Angular-DD0031`。
 *
 * 只认 `/badge/` 这一种——`/github/stars/...`、`/endpoint?...` 这些动态徽章没有技术名可提。
 * 内容里的 `?` 之后是样式参数（`?logo=angular&logoColor=white`），取到 `?` 为止。
 */
const SHIELDS_BADGE_PATTERN =
  /img\.shields\.io\/badge\/(?<content>[^)\s"'#?]+)/gi;

/**
 * 洗掉 README 里对「了解这个人」没用的噪音：
 * YAML frontmatter / 图片 / HTML 注释 / 引用式链接定义 / 链接地址（保留链接文字）。
 *
 * **徽章例外**：badge 墙虽然也是图片，但它往往就是一份技术栈清单
 * （典型 profile README：`#### Main Lan` 底下全是 `badge/Angular-DD0031` 这样的徽章），
 * 所以先把名字抽出来（`extractBadges`），在这里以纯文本回填，而不是整行丢掉。
 * 代码块保留——技术栈同样藏在里面。
 *
 * @param badges 默认自行从 `raw` 抽取；调用方已经抽过时传进来复用，避免重复扫。
 */
export function cleanReadme(raw: string, badges = extractBadges(raw)): string {
  const withoutFrontmatter = stripFrontmatter(raw.replace(/\r\n/g, '\n'));

  const body = withoutFrontmatter
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
    .trim();
  const badgeLines = renderBadges(badges);

  // 徽章块拼在正文最前：`#### Main Lan` 这种「标题 + 一整墙徽章」的写法，
  // 图片被洗掉后只剩标题，要让它跟徽章块拼到一起再判一次空标题，才不会被误删
  return dropEmptyHeadings(
    [badgeLines, body].filter((part) => part.length > 0).join('\n\n'),
  );
}

/**
 * 把 shields.io 静态徽章解析成技术名：`badge/Angular-DD0031?logo=angular` → `Angular`。
 *
 * 规则与 shields 的静态徽章解析一致（已按 `img.shields.io` 实际返回逐条核对）：
 * 1. **最后一个 `-` 之后那段永远是颜色**（不判颜色名，`badge/Angular-blue` → `Angular`），
 *    前面的才是内容；
 * 2. 内容里 `_` 是空格、`--` 是 `-`；内容若还剩下 `-`，说明是「键-值」
 *    （`badge/license-MIT-green` → `license: MIT`、`badge/Node-v1.0-blue` → `Node: v1.0`）；
 * 3. 结果**必须含至少一个字母**——`badge/1.0.0-blue` 这种纯数字 / 纯色值不是技能，直接丢。
 *
 * `-HTML5-E34F26`、`Node.js-339933`、`scikit--learn-F7931E` 都会得到裸技术名，
 * 正是技能抽取要的东西。
 */
export function extractBadges(raw: string): ReadmeBadges {
  const names: string[] = [];
  const pairs: string[] = [];

  for (const match of raw.matchAll(SHIELDS_BADGE_PATTERN)) {
    const content = match.groups?.['content'];

    if (!content) {
      continue;
    }

    const parsed = parseBadgeContent(content);

    // 拿不准或明显是图片路径（`badge.svg` 之类）的，宁可不提，也别把文件后缀当技能
    if (!parsed || /\.(?:svg|png|jpe?g|gif|webp)$/i.test(parsed)) {
      continue;
    }

    const bucket = parsed.includes(':') ? pairs : names;

    if (!bucket.includes(parsed) && bucket.length < MAX_BADGE_NAMES) {
      bucket.push(parsed);
    }
  }

  return { names, pairs };
}

/** 解析单个 `badge/` 后面的内容段；拿不准就返回 `null`（宁可不提，也别提错）。 */
function parseBadgeContent(rawContent: string): string | null {
  const cut = rawContent.lastIndexOf('-');
  const masked = maskBadgeText(
    decodeUrlText(cut < 0 ? rawContent : rawContent.slice(0, cut)),
  );
  const parts = masked.split('-');
  const hasKey = parts.length > 1 && parts[0].length > 0;
  const raw = unmaskBadgeText(
    hasKey ? parts.slice(0, -1).join('-') : parts.join('-'),
  );
  // 开头的 `-` 是 shields 允许的「空键」写法（`badge/-HTML5-E34F26`），渲染出来没有它
  const name = orNull(raw.replace(/^-+/, '').trim());
  const value = hasKey ? unmaskBadgeText(parts[parts.length - 1]).trim() : '';

  return name && value.length > 0 ? `${name}: ${value}` : name;
}

/** 只在结果里留下可读的技术名：纯数字 / 纯色值一律返回 `null`。 */
function orNull(value: string): string | null {
  return /\p{L}/u.test(value) ? value : null;
}

const ESCAPED_UNDERSCORE = '\u0000';
const ESCAPED_HYPHEN = '\u0001';

/**
 * 把 shields 的转义换成占位符：`__` → `_`、`_` → 空格、`--` → `-`。
 * 单个 `-` 留着当「键 / 值」分隔符，转义来的连字符换成占位符，才不会被误拆
 * （`scikit--learn` 是技能名，不是 `scikit: learn`）。
 */
function maskBadgeText(value: string): string {
  return value
    .replace(/__/g, ESCAPED_UNDERSCORE)
    .replace(/--/g, ESCAPED_HYPHEN)
    .replace(/_/g, ' ');
}

/** 切完「键 / 值」再还原占位符。 */
function unmaskBadgeText(value: string): string {
  return value
    .split(ESCAPED_HYPHEN)
    .join('-')
    .split(ESCAPED_UNDERSCORE)
    .join('_');
}

/** 徽章里的 `%20` 就是空格（`badge/Ant%20Design-...`），解码失败就按原文留着。 */
function decodeUrlText(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 徽章文字块：技术名一行、`键: 值`（License / 版本之类）一行。 */
function renderBadges(badges: ReadmeBadges): string {
  const lines: string[] = [];

  if (badges.names.length > 0) {
    lines.push(`技术徽章：${badges.names.join('、')}`);
  }

  if (badges.pairs.length > 0) {
    lines.push(`其它徽章：${badges.pairs.join('、')}`);
  }

  return lines.join('\n');
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
 * 跑两遍：徽章块是插到正文最前面的，会挡住第一遍的判断。
 */
function dropEmptyHeadings(text: string): string {
  let current = text;

  for (let round = 0; round < 2; round += 1) {
    const lines = current.split('\n');
    const kept: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (
        /^#{1,6}\s/.test(line.trim()) &&
        nextContentIsHeading(lines, index + 1)
      ) {
        continue;
      }

      kept.push(line);
    }

    current = kept
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return current;
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
  return (
    parts.reduce((total, part) => total + part.length, 0) +
    (parts.length - 1) * 2
  );
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
  return [...repos].sort(
    (left, right) =>
      Number(isProfileRepo(right.fullName, target)) -
      Number(isProfileRepo(left.fullName, target)),
  );
}

/** 仓库名与用户名相同（大小写不敏感）＝ 账号主页自述 README。 */
function isProfileRepo(fullName: string, target: GithubTarget): boolean {
  return (
    fullName.toLowerCase() === `${target.owner}/${target.owner}`.toLowerCase()
  );
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
 *
 * 注意：**资料卡里不列徽章技能名**——正文里徽章已经在描述账号是本人、最该放最前的
 * profile README 那个仓库块里出现过一次（`renderRepoHead`），再列一遍只会白占预算。
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
    [
      'Twitter',
      profile.twitter ? `@${inline(profile.twitter, 60) ?? ''}` : null,
    ],
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
  const isProfileReadme = isProfileRepo(doc.fullName, target);

  if (doc.description) facts.push(`简介：${doc.description}`);
  if (doc.language) facts.push(`主要语言：${doc.language}`);
  if (doc.stars > 0) facts.push(`Star：${doc.stars}`);
  if (doc.topics.length > 0) facts.push(`Topics：${doc.topics.join('、')}`);

  // 徽章墙本来就是一份技术栈清单（`badge/Angular-DD0031` → Angular），
  // 正文里那些图片行被洗掉了，这里把抽出来的技能名补回去，别让技能跟着徽章一起消失
  if (doc.badges.names.length > 0) {
    facts.push(`技术徽章：${doc.badges.names.join('、')}`);
  }

  if (doc.badges.pairs.length > 0) {
    facts.push(`其它徽章：${doc.badges.pairs.join('、')}`);
  }

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
