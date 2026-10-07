import type { MapIngestResult } from '../ai/schemas/map-ingest.schema.js';

/**
 * 「文本 / PDF / GitHub → AI 归类」链路的类型（《项目规划》第 13.9 节）。
 */

/** Multer 内存存储下的上传文件（不引 `@types/multer`，只声明用得到的字段）。 */
export interface UploadedPdfFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** GitHub 录入的来源信息。 */
export interface GithubIngestMeta {
  /** 归一化后的来源：`owner` 或 `owner/repo` */
  source: string;
  owner: string;
  /** overview 资料卡读到了就带上（读不到为 null，不影响归类） */
  profile: { login: string; name: string | null; bio: string | null } | null;
  /** 实际读到 README 的仓库（`owner/repo`） */
  repos: string[];
  /** 没有 README 或读取失败的仓库数 */
  skipped: number;
  /** 纳入分析的公开仓库总数（不含 fork，已按上限截断） */
  totalRepos: number;
}

export interface IngestMeta {
  /** 实际参与归类的字数 */
  chars: number;
  /** 是否因过长被截断 */
  truncated: boolean;
  /** 只有 GitHub 录入才有 */
  github?: GithubIngestMeta;
}

export interface IngestResult {
  /** 待用户确认的候选，结构见《项目规划》第 13.9 节 */
  candidates: MapIngestResult;
  meta: IngestMeta;
}
