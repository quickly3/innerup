import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Observable } from 'rxjs';

import { describeHttpError } from '../../core/api/http-error';
import {
  EMPTY_RESULT_HINT,
  INPUT_KIND_LABELS,
  INPUT_KINDS,
  INPUT_STATUSES,
  INTEREST_STATUSES,
  KIND_ICONS,
  KIND_LABELS,
  STATUS_LABELS,
  MapService,
  type Candidates,
  type GithubIngestMeta,
  type MapKind,
  type MapSnapshot,
  type SnapshotItem,
} from '../../core/api/map.service';

/** 预置引导问题（第 13.9 节「不留空白输入框」），与后端 prompt 的文案一致。 */
const GUIDE_QUESTIONS = [
  '最近一次忘记时间是什么时候？',
  '你在为什么发愁？',
  '有什么一直想学没开始的？',
] as const;

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** 候选条目的统一视图模型：五类共用一套「改 / 删 / 换类」交互。 */
interface CandidateRow {
  kind: MapKind;
  /** 主文案（focus/input 用 title，其余用 name/statement）。 */
  label: string;
  detail: string;
  confidence: number;
  reason: string;
  /** 换类时的目标 kind；null 表示不换。 */
  moveTo: MapKind | null;
  selected: boolean;
  /** 原始候选对象，确认时原样提交（用户编辑过字段也写回这里）。 */
  raw: Record<string, unknown>;
}

const ALL_KINDS: MapKind[] = ['focus', 'interest', 'input', 'knowledge', 'skill'];

/**
 * 个人档案 / 成长地图（M2.5）。
 *
 * 三段式（第 13.9 节）：录入区（文本 / PDF / 引导问题）→ 待确认区（AI 候选）→ 管理区（已落库档案）。
 * AI 失败不阻塞：提示后仍可手动新增。
 */
@Component({
  selector: 'app-map',
  imports: [
    FormsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './map.html',
  styleUrl: './map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPage {
  private readonly mapService = inject(MapService);

  protected readonly guideQuestions = GUIDE_QUESTIONS;
  protected readonly kindLabels = KIND_LABELS;
  protected readonly kindIcons = KIND_ICONS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly inputKindLabels = INPUT_KIND_LABELS;
  protected readonly allKinds = ALL_KINDS;
  protected readonly manualPlaceholders = MANUAL_PLACEHOLDERS;

  // ── 录入区
  protected readonly text = signal('');
  protected readonly pdfName = signal<string | null>(null);
  protected readonly pdfChars = signal<number | null>(null);
  /** 选中的 PDF：拖拽与点击选择都写到这里，上传时直接用（不再回 DOM 里捞）。 */
  protected readonly pdfFile = signal<File | null>(null);
  protected readonly pdfDragging = signal(false);
  protected readonly githubUrl = signal('');
  protected readonly githubInfo = signal<string | null>(null);
  protected readonly ingesting = signal(false);
  protected readonly ingestError = signal<string | null>(null);
  protected readonly emptyResult = signal(false);

  protected readonly emptyResultHint = EMPTY_RESULT_HINT;

  // ── 待确认区
  protected readonly candidates = signal<CandidateRow[]>([]);
  protected readonly applying = signal(false);
  /** 候选很少时提示「可能是重复」，见 13.9「结果少」 */
  protected readonly fewResultsHint = signal<string | null>(null);

  // ── 管理区
  protected readonly snapshot = signal<MapSnapshot | null>(null);
  protected readonly loadingSnapshot = signal(false);
  protected readonly snapshotError = signal<string | null>(null);
  /** 正在编辑的条目：`kind:id` → 草稿字段。 */
  protected readonly editing = signal<{ kind: MapKind; id: string; draft: string } | null>(
    null,
  );
  protected readonly saving = signal<string | null>(null);
  /** 手动新增哪一类（null = 没在新增）。 */
  protected readonly manualKind = signal<MapKind | null>(null);
  protected readonly manualLabel = signal('');
  protected readonly manualSaving = signal(false);
  /**
   * 输入标记「读完」却没有消化出口时的提醒（第 13.3 节的硬要求）。
   *
   * 提示里带一个「补一句收获」的输入框——不给出可操作的补救路径，提示就只是噪音。
   */
  protected readonly outletNotice = signal<{ id: string; label: string } | null>(null);
  protected readonly outletDraft = signal('');
  protected readonly outletSaving = signal(false);

  protected readonly selectedCount = computed(
    () => this.candidates().filter((row) => row.selected).length,
  );

  protected readonly allSelected = computed(() => {
    const rows = this.candidates();

    return rows.length > 0 && rows.every((row) => row.selected);
  });

  protected readonly confidenceLevels = [1, 2, 3, 4, 5] as const;

  constructor() {
    this.refreshSnapshot();
  }

  // ── 录入区

  protected fillGuideQuestion(question: string): void {
    const current = this.text();
    this.text.set(current ? `${current}\n${question}` : question);
  }

  protected onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.clearPdfState();
      return;
    }

    this.acceptPdf(file, () => (input.value = ''));
  }

  /** 拖拽上传（第 13.9 节：点击或拖拽都可以）。 */
  protected onPdfDrop(event: DragEvent): void {
    event.preventDefault();
    this.pdfDragging.set(false);

    this.acceptPdf(event.dataTransfer?.files?.[0] ?? null);
  }

  protected onPdfDragOver(event: DragEvent): void {
    event.preventDefault();
    this.pdfDragging.set(true);
  }

  protected onPdfDragLeave(): void {
    this.pdfDragging.set(false);
  }

  /** 选中 / 拖入一份 PDF：类型与大小先在前端拦一次，避免白跑一趟上传。 */
  private acceptPdf(file: File | null, resetInput?: () => void): void {
    this.ingestError.set(null);

    if (!file) {
      this.clearPdfState();
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.ingestError.set('只支持 PDF 文件');
      resetInput?.();
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      this.ingestError.set('PDF 不能超过 10MB');
      resetInput?.();
      return;
    }

    this.pdfFile.set(file);
    this.pdfName.set(file.name);
    this.pdfChars.set(null);
  }

  private clearPdfState(): void {
    this.pdfFile.set(null);
    this.pdfName.set(null);
    this.pdfChars.set(null);
  }

  protected clearPdf(event: Event): void {
    event.stopPropagation();
    this.clearPdfState();
    this.ingestError.set(null);
  }

  protected ingest(): void {
    const pdf = this.pdfFile();
    const text = this.text().trim();

    if (pdf) {
      this.ingestPdf();
      return;
    }

    if (text.length < 15) {
      this.ingestError.set('再多写几句（至少 15 个字），AI 才有得归类');
      return;
    }

    this.ingesting.set(true);
    this.ingestError.set(null);
    this.emptyResult.set(false);
    this.fewResultsHint.set(null);

    this.mapService.ingestText(text).subscribe({
      next: (result) => this.onIngested(result),
      error: (error: unknown) => {
        this.ingesting.set(false);
        this.ingestError.set(describeHttpError(error));
      },
    });
  }

  /** GitHub 地址录入：后端读公开仓库 README 再交给同一条归类链路。 */
  protected ingestGithub(): void {
    const url = this.githubUrl().trim();

    if (url.length === 0) {
      this.ingestError.set('先填一个 GitHub 地址，例如 https://github.com/yourname');
      return;
    }

    this.ingesting.set(true);
    this.ingestError.set(null);
    this.emptyResult.set(false);
    this.githubInfo.set(null);
    this.fewResultsHint.set(null);

    this.mapService.ingestGithub(url).subscribe({
      next: (result) => {
        this.githubInfo.set(describeGithubImport(result.meta.github));
        this.onIngested(result);
      },
      error: (error: unknown) => {
        this.ingesting.set(false);
        this.ingestError.set(describeHttpError(error));
      },
    });
  }

  private ingestPdf(): void {
    const file = this.pdfFile();

    if (!file) {
      this.ingestError.set('请先选择一份 PDF');
      return;
    }

    this.ingesting.set(true);
    this.ingestError.set(null);
    this.emptyResult.set(false);
    this.fewResultsHint.set(null);

    this.mapService.ingestPdf(file).subscribe({
      next: (result) => {
        this.pdfChars.set(result.meta.chars);
        this.onIngested(result);
      },
      error: (error: unknown) => {
        this.ingesting.set(false);
        this.ingestError.set(describeHttpError(error));
      },
    });
  }

  private onIngested(result: { candidates: Candidates }): void {
    this.ingesting.set(false);

    const rows = ALL_KINDS.flatMap((kind) =>
      (result.candidates[kind] as unknown as Array<Record<string, unknown>>).map(
        (raw) => this.toRow(kind, raw),
      ),
    );

    this.candidates.set(rows);
    this.emptyResult.set(rows.length === 0 && !this.hasExistingEntries());
    this.fewResultsHint.set(this.describeFewResults(rows.length));
  }

  /**
   * 候选少多半不是「AI 没读懂」，而是**大部分内容已经在档案里**（prompt 会让模型跳过重复项）。
   * 不解释清楚的话，用户会以为功能坏了。
   */
  private describeFewResults(count: number): string | null {
    if (!this.hasExistingEntries()) {
      return null;
    }

    if (count === 0) {
      return '这次没有新增：识别到的内容基本都已经在档案里了（AI 会自动跳过重复项）。想补充新内容可以换个来源再试。';
    }

    if (count <= 3) {
      return `这次只新增 ${count} 条：其余识别到的内容已经在你档案里了（AI 会自动跳过重复项，避免重复条目）。`;
    }

    return null;
  }

  private hasExistingEntries(): boolean {
    const snapshot = this.snapshot();

    return snapshot !== null && ALL_KINDS.some((kind) => snapshot[kind].length > 0);
  }

  private toRow(kind: MapKind, raw: Record<string, unknown>): CandidateRow {
    const label = String(raw['title'] ?? raw['name'] ?? raw['statement'] ?? '');
    const detailParts: string[] = [];

    if (typeof raw['why'] === 'string' && raw['why']) detailParts.push(`动机：${raw['why']}`);
    if (typeof raw['progress'] === 'string' && raw['progress']) {
      detailParts.push(`进度：${raw['progress']}`);
    }
    if (typeof raw['topic'] === 'string' && raw['topic']) detailParts.push(`领域：${raw['topic']}`);
    if (Array.isArray(raw['evidence']) && raw['evidence'].length > 0) {
      detailParts.push(`产出：${raw['evidence'].join('、')}`);
    }

    return {
      kind,
      label,
      detail: detailParts.join(' · '),
      confidence: Number(raw['confidence'] ?? 3),
      reason: typeof raw['reason'] === 'string' ? raw['reason'] : '',
      moveTo: null,
      selected: true,
      raw,
    };
  }

  // ── 待确认区

  protected toggleRow(row: CandidateRow, checked: boolean): void {
    row.selected = checked;
  }

  /** 全部确认 / 全部取消（第 13.9 节：「全部确认」与「逐条确认」都要能走）。 */
  protected toggleAllRows(): void {
    const next = !this.allSelected();

    for (const row of this.candidates()) {
      row.selected = next;
    }
    this.candidates.set([...this.candidates()]);
  }

  protected removeRow(row: CandidateRow): void {
    this.candidates.set(this.candidates().filter((item) => item !== row));
    this.emptyResult.set(this.candidates().length === 0);
  }

  protected renameRow(row: CandidateRow, label: string): void {
    row.label = label.trim();
    const key =
      row.kind === 'knowledge'
        ? 'statement'
        : row.kind === 'focus' || row.kind === 'input'
          ? 'title'
          : 'name';
    row.raw[key] = row.label;
  }

  protected moveRow(row: CandidateRow, target: MapKind | 'keep'): void {
    row.moveTo = target === 'keep' ? null : target;
  }

  protected applyCandidates(): void {
    const rows = this.candidates().filter((row) => row.selected);

    if (rows.length === 0) {
      return;
    }

    this.applying.set(true);
    this.ingestError.set(null);

    const payload: Candidates = {
      focus: [],
      interest: [],
      input: [],
      knowledge: [],
      skill: [],
    };

    for (const row of rows) {
      const target = row.moveTo ?? row.kind;
      const raw: Record<string, unknown> = { ...row.raw };

      // 换类时把主文案挪到目标类的字段上
      if (row.moveTo && row.moveTo !== row.kind) {
        delete raw['title'];
        delete raw['name'];
        delete raw['statement'];
        raw[target === 'knowledge' ? 'statement' : target === 'focus' || target === 'input' ? 'title' : 'name'] =
          row.label;
      }

      (payload[target] as unknown as Array<Record<string, unknown>>).push(raw);
    }

    this.mapService.applyCandidates(payload).subscribe({
      next: (result) => {
        this.applying.set(false);
        const total = Object.values(result.created).reduce((sum, n) => sum + n, 0);
        this.candidates.set([]);
        this.emptyResult.set(false);
        this.text.set('');
        this.pdfName.set(null);
        this.pdfChars.set(null);
        this.githubUrl.set('');
        this.githubInfo.set(null);
        this.refreshSnapshot(total);
      },
      error: (error: unknown) => {
        this.applying.set(false);
        this.ingestError.set(describeHttpError(error));
      },
    });
  }

  // ── 管理区

  protected refreshSnapshot(highlightCount = 0): void {
    this.loadingSnapshot.set(true);
    this.snapshotError.set(null);

    this.mapService.snapshot().subscribe({
      next: (snapshot) => {
        this.snapshot.set(snapshot);
        this.loadingSnapshot.set(false);
        this.lastApplied.set(highlightCount);
      },
      error: (error: unknown) => {
        this.loadingSnapshot.set(false);
        this.snapshotError.set(describeHttpError(error));
      },
    });
  }

  protected readonly lastApplied = signal(0);

  protected itemsOf(kind: MapKind): SnapshotItem[] {
    return (this.snapshot()?.[kind] ?? []) as unknown as SnapshotItem[];
  }

  protected countOf(kind: MapKind): number {
    return this.itemsOf(kind).length;
  }

  protected labelOf(kind: MapKind, item: SnapshotItem): string {
    return String(item['title'] ?? item['name'] ?? item['statement'] ?? '');
  }

  protected metaOf(kind: MapKind, item: SnapshotItem): string {
    const parts: string[] = [];

    if (kind === 'focus') {
      if (item['why']) parts.push(String(item['why']));
      parts.push(`在意程度 ${item['intensity']}`);
    } else if (kind === 'interest') {
      if (item['triedWhat']) parts.push(`试过：${item['triedWhat']}`);
    } else if (kind === 'input') {
      const kindLabel =
        INPUT_KIND_LABELS[item['kind'] as keyof typeof INPUT_KIND_LABELS] ?? item['kind'];
      parts.push(String(kindLabel));
      if (item['progress']) parts.push(String(item['progress']));
      if (Number(item['minutes']) > 0) parts.push(`${item['minutes']} 分钟`);
      if (item['takeaway']) parts.push(`收获：${item['takeaway']}`);
      else if (this.outletCount(item.id) > 0) parts.push('消化出口：知识条目');
      else parts.push('⚠ 还没有消化出口');
    } else if (kind === 'knowledge') {
      if (item['topic']) parts.push(String(item['topic']));
      parts.push(`掌握 ${item['confidence']}/5`);
    } else if (kind === 'skill') {
      parts.push(`Lv.${item['level']} · ${item['xp']} XP`);
      const evidence = item['evidence'];
      if (Array.isArray(evidence) && evidence.length > 0) {
        parts.push(`产出 ${evidence.length} 件`);
      } else {
        parts.push('⚠ 还没有产出物');
      }
    }

    return parts.join(' · ');
  }

  /**
   * 这条输入产出了几条知识（第 13.3 节：消化出口 = 一句话收获**或**一条知识条目）。
   * 快照里两者都在，所以在浏览器端算就够，不用为它单独加接口。
   */
  private outletCount(inputId: string): number {
    const knowledge = (this.snapshot()?.knowledge ?? []) as unknown as SnapshotItem[];

    return knowledge.filter((item) => item['sourceInputId'] === inputId).length;
  }

  /** 有没有消化出口：一句话收获，或至少产出一条知识。 */
  private hasOutlet(item: SnapshotItem): boolean {
    const takeaway = item['takeaway'];

    return (
      (typeof takeaway === 'string' && takeaway.trim().length > 0) ||
      this.outletCount(String(item['id'])) > 0
    );
  }

  protected statusOf(item: SnapshotItem): string | null {
    const status = item['status'];
    return typeof status === 'string' && status in STATUS_LABELS
      ? STATUS_LABELS[status]
      : null;
  }

  protected statusOptions(kind: MapKind): string[] {
    if (kind === 'focus') return [...FOCUS_STATUS_VALUES];
    if (kind === 'interest') return [...INTEREST_STATUS_VALUES];
    if (kind === 'input') return [...INPUT_STATUS_VALUES];
    return [];
  }

  protected changeStatus(kind: MapKind, id: string, status: string): void {
    this.outletNotice.set(null);

    // 第 13.3 节：输入标记「读完」却没有消化出口时，明确提示而不是静默放过
    if (kind === 'input' && status === 'finished') {
      const item = this.itemsOf('input').find((row) => row['id'] === id);

      if (item && !this.hasOutlet(item)) {
        this.outletDraft.set('');
        this.outletNotice.set({ id, label: this.labelOf('input', item) });
      }
    }

    this.save(kind, id, { status });
  }

  /** 提示里的「补一句收获」：直接 PATCH `takeaway`，这条输入就算有了消化出口。 */
  protected saveOutlet(): void {
    const notice = this.outletNotice();
    const takeaway = this.outletDraft().trim();

    if (!notice) return;

    if (takeaway.length === 0) {
      this.snapshotError.set('先写一句收获，或者让它产出一条知识条目');
      return;
    }

    this.outletSaving.set(true);

    this.mapService.update('input', notice.id, { takeaway }).subscribe({
      next: () => {
        this.outletSaving.set(false);
        this.outletNotice.set(null);
        this.outletDraft.set('');
        this.refreshSnapshot();
      },
      error: (error: unknown) => {
        this.outletSaving.set(false);
        this.snapshotError.set(describeHttpError(error));
      },
    });
  }

  protected dismissOutlet(): void {
    this.outletNotice.set(null);
    this.outletDraft.set('');
  }

  // ── 手动新增（第 13.9 节：AI 失败时的降级入口，五类各一个「＋ 手动新增」）

  protected startManualAdd(kind: MapKind): void {
    this.manualKind.set(kind);
    this.manualLabel.set('');
    this.snapshotError.set(null);
  }

  protected cancelManualAdd(): void {
    this.manualKind.set(null);
    this.manualLabel.set('');
  }

  protected submitManualAdd(): void {
    const kind = this.manualKind();
    const label = this.manualLabel().trim();

    if (!kind) return;

    if (label.length === 0) {
      this.snapshotError.set(`先写一句${KIND_LABELS[kind]}内容`);
      return;
    }

    const payload = { [MANUAL_FIELDS[kind]]: label } as Record<string, unknown>;
    // 五类返回不同的实体类型，统一收敛成 Observable<unknown> 再订阅
    const request: Observable<unknown> =
      kind === 'focus'
        ? this.mapService.createFocus(payload)
        : kind === 'interest'
          ? this.mapService.createInterest(payload)
          : kind === 'input'
            ? this.mapService.createInput(payload)
            : kind === 'knowledge'
              ? this.mapService.createKnowledge(payload)
              : this.mapService.createSkill(payload);

    this.manualSaving.set(true);

    request.subscribe({
      next: () => {
        this.manualSaving.set(false);
        this.cancelManualAdd();
        this.refreshSnapshot();
      },
      error: (error: unknown) => {
        this.manualSaving.set(false);
        this.snapshotError.set(describeHttpError(error));
      },
    });
  }

  protected startEdit(kind: MapKind, id: string, current: string): void {
    this.editing.set({ kind, id, draft: current });
  }

  protected cancelEdit(): void {
    this.editing.set(null);
  }

  protected saveEdit(): void {
    const editing = this.editing();

    if (!editing) return;

    const draft = editing.draft.trim();

    if (draft.length === 0) {
      this.cancelEdit();
      return;
    }

    const key =
      editing.kind === 'knowledge'
        ? 'statement'
        : editing.kind === 'interest' || editing.kind === 'skill'
          ? 'name'
          : 'title';

    this.save(editing.kind, editing.id, { [key]: draft });
  }

  protected removeItem(kind: MapKind, id: string): void {
    this.saving.set(`${kind}:${id}`);

    this.mapService.remove(kind, id).subscribe({
      next: () => {
        this.saving.set(null);
        this.refreshSnapshot();
      },
      error: (error: unknown) => {
        this.saving.set(null);
        this.snapshotError.set(describeHttpError(error));
      },
    });
  }

  private save(kind: MapKind, id: string, payload: Record<string, unknown>): void {
    this.saving.set(`${kind}:${id}`);
    this.editing.set(null);

    this.mapService.update(kind, id, payload).subscribe({
      next: () => {
        this.saving.set(null);
        this.refreshSnapshot();
      },
      error: (error: unknown) => {
        this.saving.set(null);
        this.snapshotError.set(describeHttpError(error));
      },
    });
  }
}

const FOCUS_STATUS_VALUES = ['active', 'cooling', 'archived'];
const INTEREST_STATUS_VALUES = ['curious', 'trying', 'ongoing', 'cool', 'dropped'];
const INPUT_STATUS_VALUES = ['queued', 'consuming', 'finished', 'dropped'];

/** 手动新增时每类的必填字段：其余字段用后端默认值，之后再改（第 13.8 节）。 */
const MANUAL_FIELDS: Record<MapKind, string> = {
  focus: 'title',
  interest: 'name',
  input: 'title',
  knowledge: 'statement',
  skill: 'name',
};

/** 手动新增输入框的占位提示，按类给出例子。 */
const MANUAL_PLACEHOLDERS: Record<MapKind, string> = {
  focus: '例如：想转岗做数据',
  interest: '例如：弹吉他',
  input: '例如：《数据分析实战》',
  knowledge: '例如：留存率要按同期群拆开看',
  skill: '例如：能独立拉出漏斗查询',
};

/** 告诉用户「读了资料卡与哪些仓库」，让他知道 AI 的判断基于什么。 */
function describeGithubImport(meta: GithubIngestMeta | undefined): string | null {
  if (!meta) {
    return null;
  }

  const who = meta.profile?.name ? `${meta.profile.name}（${meta.source}）` : meta.source;
  const read = [
    meta.profile ? '资料卡' : null,
    `${meta.repos.length} 个仓库 README`,
  ]
    .filter((item): item is string => item !== null)
    .join(' + ');
  const skipped = meta.skipped > 0 ? `，跳过 ${meta.skipped} 个没有 README 的仓库` : '';

  return `已读取 ${who}：${read}${skipped}`;
}
