/**
 * GitHub → 「资料卡 + README」纯文本 链路的类型（《项目规划》第 13.9 / 13.10 节）。
 */

/** 从用户输入里解析出的 GitHub 指向。 */
export interface GithubTarget {
  owner: string;
  /** `null` 表示整个账号（读它的公开仓库列表） */
  repo: string | null;
  /** 回显用：`owner` 或 `owner/repo` */
  display: string;
}

/** GitHub `/users/:owner` 响应（overview 资料卡）里我们关心的字段。 */
export interface GithubUserPayload {
  login?: string;
  name?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  twitter_username?: string | null;
  hireable?: boolean | null;
  public_repos?: number;
  followers?: number;
  following?: number;
  created_at?: string;
}

/** 账号资料卡（overview 页左侧那块）。 */
export interface GithubUserProfile {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter: string | null;
  hireable: boolean | null;
  publicRepos: number;
  followers: number;
  following: number;
  /** 注册时间，取到月份（`2015-03`） */
  joinedAt: string | null;
}

/** GitHub `/users/:owner/repos`、`/repos/:owner/:repo` 响应里我们关心的字段。 */
export interface GithubRepoPayload {
  full_name?: string;
  name?: string;
  description?: string | null;
  language?: string | null;
  topics?: string[];
  stargazers_count?: number;
  fork?: boolean;
}

/** 单个仓库的元信息 + 清洗后的 README 正文（内部形态）。 */
export interface GithubRepoDoc {
  /** `owner/repo`，取自 GitHub 返回的规范写法 */
  fullName: string;
  /** 仓库名，拼 API 路径用 */
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  /** `cleanReadme` 之后并按 `GITHUB_MAX_README_CHARS` 截断的正文 */
  readme: string;
}

/** 返回给前端的「读了哪些仓库」摘要（不含正文）。 */
export interface GithubRepoNote {
  fullName: string;
  chars: number;
}

export interface GithubComposeResult {
  text: string;
  repos: GithubRepoNote[];
  truncated: boolean;
}

/** GitHub 录入链路的结果：拼好的文本 + 读取情况。 */
export interface GithubReadmeBundle {
  target: GithubTarget;
  /** overview 资料卡；读不到时为 `null`（不阻塞 README 分析） */
  profile: GithubUserProfile | null;
  /** 资料卡 + 仓库元信息 + README 摘录，长度不超过 `MAX_INGEST_CHARS` */
  text: string;
  /** 实际读到 README 的仓库（按读取顺序） */
  repos: GithubRepoNote[];
  /** 没有 README 或读取失败的仓库数 */
  skipped: number;
  /** 纳入分析的公开仓库总数（不含 fork，已按上限截断） */
  totalRepos: number;
  truncated: boolean;
}
