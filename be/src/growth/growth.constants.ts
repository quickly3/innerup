/** 成长地图的五个资源段（`/api/map/:kind/:id` 里的 `kind`）。 */
export enum MapKind {
  Focus = 'focus',
  Interest = 'interest',
  Input = 'input',
  Knowledge = 'knowledge',
  Skill = 'skill',
}

export const FOCUS_STATUSES = ['active', 'cooling', 'archived'] as const;
export const INTEREST_STATUSES = [
  'curious',
  'trying',
  'ongoing',
  'cool',
  'dropped',
] as const;
export const INPUT_KINDS = [
  'book',
  'course',
  'article',
  'podcast',
  'video',
] as const;
export const INPUT_STATUSES = [
  'queued',
  'consuming',
  'finished',
  'dropped',
] as const;

export const MAX_INGEST_CHARS = 20_000;
export const MIN_INGEST_CHARS = 15;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const PDF_MIME_TYPE = 'application/pdf';

// ── GitHub 录入（《项目规划》第 13.9 节「GitHub 地址录入」）────────────
/** 只打这个固定域名，用户给的地址只用来解析 owner / repo（防 SSRF）。 */
export const GITHUB_API_BASE_URL = 'https://api.github.com';
export const GITHUB_API_VERSION = '2022-11-28';
/** 单次最多分析多少个仓库的 README（配置了 GITHUB_TOKEN 时）。 */
export const GITHUB_MAX_REPOS = 12;
/** 未配置 GITHUB_TOKEN 时收紧到 6 个：未认证额度只有 60 次/小时。 */
export const GITHUB_MAX_REPOS_NO_TOKEN = 6;
/** 拉仓库列表时请求的条数（GitHub 单页上限 100），过滤掉 fork 后再截到上面的上限。 */
export const GITHUB_REPO_FETCH_LIMIT = 100;
/** 单个 README 最多取多少字，避免一个仓库吃掉整份预算。 */
export const GITHUB_MAX_README_CHARS = 3_000;
/** 同时在飞的 README 请求数。 */
export const GITHUB_README_CONCURRENCY = 3;
export const GITHUB_REQUEST_TIMEOUT_MS = 10_000;

/** 把名字归一化后用作「同批次内互相挂靠」的匹配键。 */
export function matchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}
