/**
 * 成长地图（个人档案）的类型与服务（《项目规划》第 13.8 / 13.9 节）。
 *
 * 与后端 `be/src/growth` 的 DTO 一一对应；`confidence` 是 AI 对**归类本身**的把握，
 * 不是「掌握程度」。
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

export type MapKind = 'focus' | 'interest' | 'input' | 'knowledge' | 'skill';

export const MAP_KINDS: readonly MapKind[] = [
  'focus',
  'interest',
  'input',
  'knowledge',
  'skill',
];

export const KIND_LABELS: Record<MapKind, string> = {
  focus: '关注点',
  interest: '兴趣',
  input: '输入',
  knowledge: '知识',
  skill: '技能',
};

export const KIND_ICONS: Record<MapKind, string> = {
  focus: 'center_focus_strong',
  interest: 'interests',
  input: 'menu_book',
  knowledge: 'psychology',
  skill: 'construction',
};

export const FOCUS_STATUSES = ['active', 'cooling', 'archived'] as const;
export const INTEREST_STATUSES = [
  'curious',
  'trying',
  'ongoing',
  'cool',
  'dropped',
] as const;
export const INPUT_KINDS = ['book', 'course', 'article', 'podcast', 'video'] as const;
export const INPUT_STATUSES = ['queued', 'consuming', 'finished', 'dropped'] as const;

export const INPUT_KIND_LABELS: Record<(typeof INPUT_KINDS)[number], string> = {
  book: '书',
  course: '课程',
  article: '文章',
  podcast: '播客',
  video: '视频',
};

export const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  cooling: '降温中',
  archived: '已归档',
  curious: '好奇',
  trying: '试水中',
  ongoing: '持续',
  cool: '冷却',
  dropped: '放弃',
  queued: '想读',
  consuming: '在读',
  finished: '读完',
};

export interface Focus {
  id: string;
  title: string;
  why: string | null;
  intensity: number;
  status: string;
  reviewAt: string | null;
  createdAt: string;
}

export interface Interest {
  id: string;
  focusId: string | null;
  name: string;
  status: string;
  triedWhat: string | null;
  color: string | null;
  createdAt: string;
}

export interface InputItem {
  id: string;
  interestId: string | null;
  title: string;
  kind: string;
  source: string | null;
  status: string;
  progress: string | null;
  minutes: number;
  takeaway: string | null;
  createdAt: string;
}

export interface Knowledge {
  id: string;
  sourceInputId: string | null;
  statement: string;
  topic: string | null;
  confidence: number;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface Skill {
  id: string;
  name: string;
  level: number;
  xp: number;
  color: string | null;
  evidence: string[];
  lastPracticedAt: string | null;
}

export interface MapSnapshot {
  focus: Focus[];
  interest: Interest[];
  input: InputItem[];
  knowledge: Knowledge[];
  skill: Skill[];
}

/** AI 归类候选（用户可改 / 删 / 换类后再确认）。 */
export interface FocusCandidate extends Partial<Focus> {
  title: string;
  confidence: number;
  reason?: string | null;
}

export interface InterestCandidate extends Partial<Interest> {
  name: string;
  confidence: number;
  reason?: string | null;
  focusTitle?: string | null;
}

export interface InputCandidate extends Partial<InputItem> {
  title: string;
  confidence: number;
  reason?: string | null;
  interestName?: string | null;
}

export interface KnowledgeCandidate extends Partial<Knowledge> {
  statement: string;
  confidence: number;
  reason?: string | null;
  inputTitle?: string | null;
}

export interface SkillCandidate extends Partial<Skill> {
  name: string;
  confidence: number;
  reason?: string | null;
}

export interface Candidates {
  focus: FocusCandidate[];
  interest: InterestCandidate[];
  input: InputCandidate[];
  knowledge: KnowledgeCandidate[];
  skill: SkillCandidate[];
}

export interface IngestResult {
  candidates: Candidates;
  meta: IngestMeta;
}

/** GitHub 录入的读取情况（只有 `ingestGithub` 的 meta 里才有）。 */
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
  /** 纳入分析的公开仓库总数 */
  totalRepos: number;
}

export interface IngestMeta {
  chars: number;
  truncated: boolean;
  github?: GithubIngestMeta;
}

export interface ApplyResult {
  created: Record<MapKind, number>;
  skipped: { skill: number };
}

/** 管理区条目的统一视图模型：五类字段并集（快照行）。 */
export type SnapshotItem = Record<string, unknown> & { id: string };

/** 手动新增 / 编辑的载荷：五类字段并集，后端按 kind 校验。 */
export type MapItemPayload = Record<string, unknown>;

/** AI 归类结果为空时给用户的提示（第 13.9 节「归类结果为空」）。 */
export const EMPTY_RESULT_HINT = '没识别到可归类的信息，换个写法再试';

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly http = inject(HttpClient);

  /** 档案快照：五类对象一次取全。 */
  snapshot(): Observable<MapSnapshot> {
    return this.http.get<MapSnapshot>('/map');
  }

  /** 文本录入 → AI 归类，返回待确认候选（不落库）。 */
  ingestText(text: string): Observable<IngestResult> {
    return this.http.post<IngestResult>('/map/ingest', { text });
  }

  /** PDF 上传 → 抽文本 → AI 归类（≤10MB，仅文本层）。 */
  ingestPdf(file: File): Observable<IngestResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<IngestResult>('/map/ingest/pdf', form);
  }

  /** GitHub 账号 / 仓库地址 → 后端读公开仓库 README → AI 归类。 */
  ingestGithub(url: string): Observable<IngestResult> {
    return this.http.post<IngestResult>('/map/ingest/github', { url });
  }

  /** 确认候选（可编辑 / 部分确认）后落库。 */
  applyCandidates(candidates: Candidates): Observable<ApplyResult> {
    return this.http.post<ApplyResult>('/map/candidates/apply', { candidates });
  }

  createFocus(payload: MapItemPayload): Observable<Focus> {
    return this.http.post<Focus>('/map/focus', payload);
  }

  createInterest(payload: MapItemPayload): Observable<Interest> {
    return this.http.post<Interest>('/map/interest', payload);
  }

  createInput(payload: MapItemPayload): Observable<InputItem> {
    return this.http.post<InputItem>('/map/input', payload);
  }

  createKnowledge(payload: MapItemPayload): Observable<Knowledge> {
    return this.http.post<Knowledge>('/map/knowledge', payload);
  }

  createSkill(payload: MapItemPayload): Observable<Skill> {
    return this.http.post<Skill>('/map/skill', payload);
  }

  update(kind: MapKind, id: string, payload: MapItemPayload): Observable<unknown> {
    return this.http.patch(`/map/${kind}/${id}`, payload);
  }

  remove(kind: MapKind, id: string): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(`/map/${kind}/${id}`);
  }
}
