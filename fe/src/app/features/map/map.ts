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

  // ── 录入区
  protected readonly text = signal('');
  protected readonly pdfName = signal<string | null>(null);
  protected readonly pdfChars = signal<number | null>(null);
  protected readonly ingesting = signal(false);
  protected readonly ingestError = signal<string | null>(null);
  protected readonly emptyResult = signal(false);

  protected readonly emptyResultHint = EMPTY_RESULT_HINT;

  // ── 待确认区
  protected readonly candidates = signal<CandidateRow[]>([]);
  protected readonly applying = signal(false);

  // ── 管理区
  protected readonly snapshot = signal<MapSnapshot | null>(null);
  protected readonly loadingSnapshot = signal(false);
  protected readonly snapshotError = signal<string | null>(null);
  /** 正在编辑的条目：`kind:id` → 草稿字段。 */
  protected readonly editing = signal<{ kind: MapKind; id: string; draft: string } | null>(
    null,
  );
  protected readonly saving = signal<string | null>(null);

  protected readonly selectedCount = computed(
    () => this.candidates().filter((row) => row.selected).length,
  );

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
    this.ingestError.set(null);

    if (!file) {
      this.pdfName.set(null);
      this.pdfChars.set(null);
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      this.ingestError.set('PDF 不能超过 10MB');
      input.value = '';
      return;
    }

    this.pdfName.set(file.name);
    this.pdfChars.set(null);
  }

  protected clearPdf(event: Event): void {
    event.stopPropagation();
    this.pdfName.set(null);
    this.pdfChars.set(null);
    this.ingestError.set(null);
  }

  protected ingest(): void {
    const pdf = this.pdfName();
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

    this.mapService.ingestText(text).subscribe({
      next: (result) => this.onIngested(result),
      error: (error: unknown) => {
        this.ingesting.set(false);
        this.ingestError.set(describeError(error));
      },
    });
  }

  private ingestPdf(): void {
    const input = document.querySelector<HTMLInputElement>('#map-pdf-input');
    const file = input?.files?.[0];

    if (!file) {
      this.ingestError.set('请先选择一份 PDF');
      return;
    }

    this.ingesting.set(true);
    this.ingestError.set(null);
    this.emptyResult.set(false);

    this.mapService.ingestPdf(file).subscribe({
      next: (result) => {
        this.pdfChars.set(result.meta.chars);
        this.onIngested(result);
      },
      error: (error: unknown) => {
        this.ingesting.set(false);
        this.ingestError.set(describeError(error));
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
    this.emptyResult.set(rows.length === 0);
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
        this.refreshSnapshot(total);
      },
      error: (error: unknown) => {
        this.applying.set(false);
        this.ingestError.set(describeError(error));
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
        this.snapshotError.set(describeError(error));
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
    this.save(kind, id, { status });
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
        this.snapshotError.set(describeError(error));
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
        this.snapshotError.set(describeError(error));
      },
    });
  }
}

const FOCUS_STATUS_VALUES = ['active', 'cooling', 'archived'];
const INTEREST_STATUS_VALUES = ['curious', 'trying', 'ongoing', 'cool', 'dropped'];
const INPUT_STATUS_VALUES = ['queued', 'consuming', 'finished', 'dropped'];

function describeError(error: unknown): string {
  const httpError = error as { status?: number; error?: { message?: string }; message?: string };

  if (httpError?.error?.message) {
    return httpError.error.message;
  }
  if (httpError?.message) {
    return httpError.message;
  }
  return '出了点问题，请稍后再试';
}
