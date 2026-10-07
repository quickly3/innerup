import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  Focus,
  InputItem,
  Interest,
  Knowledge,
  Prisma,
  Skill,
} from '../generated/prisma/client.js';
import { CurrentUserService } from '../common/current-user.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ExistingMapSummary } from '../ai/prompts/map-ingest.prompt.js';
import type { CandidatesDto } from './dto/candidates.dto.js';
import type {
  CreateFocusDto,
  CreateInputDto,
  CreateInterestDto,
  CreateKnowledgeDto,
  CreateSkillDto,
} from './dto/create-item.dto.js';
import type { UpdateMapItemDto } from './dto/update-item.dto.js';
import {
  FOCUS_STATUSES,
  INPUT_STATUSES,
  INTEREST_STATUSES,
  MapKind,
  matchKey,
} from './growth.constants.js';

/** 五类对象一次取全（`GET /api/map`），前端据此渲染「管理区」。 */
export interface MapSnapshot {
  focus: Focus[];
  interest: Interest[];
  input: InputItem[];
  knowledge: Knowledge[];
  skill: Skill[];
}

export interface ApplyCandidatesResult {
  created: Record<MapKind, number>;
  skipped: { skill: number };
}

/** 知识条目的「掌握程度」默认值：AI 归类归到底，把握程度得用户自己填。 */
const DEFAULT_KNOWLEDGE_CONFIDENCE = 3;
/** 喂给 prompt 的已有条目摘要长度上限，避免把提示词撑爆。 */
const SUMMARY_TEXT_LIMIT = 60;
/** 一次「全部确认」的落库上限，避免交互式事务超时。 */
const APPLY_TRANSACTION_TIMEOUT_MS = 20_000;

/** `PATCH` 时每一类允许更新的字段；传了别的字段直接 400，不做静默忽略。 */
const UPDATE_FIELDS: Record<MapKind, readonly (keyof UpdateMapItemDto)[]> = {
  [MapKind.Focus]: ['title', 'why', 'intensity', 'status', 'reviewAt'],
  [MapKind.Interest]: ['name', 'status', 'triedWhat', 'color', 'focusId'],
  [MapKind.Input]: [
    'title',
    'kind',
    'source',
    'status',
    'progress',
    'minutes',
    'takeaway',
    'interestId',
  ],
  [MapKind.Knowledge]: [
    'statement',
    'topic',
    'confidence',
    'lastCheckedAt',
    'sourceInputId',
  ],
  [MapKind.Skill]: [
    'name',
    'color',
    'level',
    'xp',
    'evidence',
    'lastPracticedAt',
  ],
};

const STATUSES_BY_KIND: Partial<Record<MapKind, readonly string[]>> = {
  [MapKind.Focus]: FOCUS_STATUSES,
  [MapKind.Interest]: INTEREST_STATUSES,
  [MapKind.Input]: INPUT_STATUSES,
};

/**
 * 成长地图的读写（《项目规划》第 13 节）。
 *
 * 只负责「录入与归类结果落库 + 管理」；看板（M8）与自动维护（M9）不在这里。
 */
@Injectable()
export class GrowthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  async snapshot(): Promise<MapSnapshot> {
    const userId = await this.currentUser.ensureUserId();

    const [focus, interest, input, knowledge, skill] = await Promise.all([
      this.prisma.focus.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.interest.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.inputItem.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.knowledge.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.skill.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { focus, interest, input, knowledge, skill };
  }

  /** 已有档案摘要，喂给归类 prompt，避免重复拆出同样的条目。 */
  async existingSummary(): Promise<ExistingMapSummary> {
    const { focus, interest, input, knowledge, skill } =
      await this.snapshot();

    return {
      focus: focus.map((item) => item.title),
      interest: interest.map((item) => item.name),
      input: input.map((item) => item.title),
      knowledge: knowledge.map((item) => truncate(item.statement)),
      skill: skill.map((item) => item.name),
    };
  }

  async createFocus(dto: CreateFocusDto): Promise<Focus> {
    const userId = await this.currentUser.ensureUserId();

    return this.prisma.focus.create({
      data: {
        userId,
        title: dto.title.trim(),
        why: normalizeText(dto.why),
        intensity: dto.intensity ?? 3,
        status: dto.status ?? 'active',
        reviewAt: parseDateOrNull(dto.reviewAt, 'reviewAt'),
      },
    });
  }

  async createInterest(dto: CreateInterestDto): Promise<Interest> {
    const userId = await this.currentUser.ensureUserId();

    if (dto.focusId) {
      await this.assertFocusExists(userId, dto.focusId);
    }

    return this.prisma.interest.create({
      data: {
        userId,
        focusId: dto.focusId ?? null,
        name: dto.name.trim(),
        status: dto.status ?? 'curious',
        triedWhat: normalizeText(dto.triedWhat),
        color: normalizeText(dto.color),
      },
    });
  }

  async createInput(dto: CreateInputDto): Promise<InputItem> {
    const userId = await this.currentUser.ensureUserId();

    if (dto.interestId) {
      await this.assertInterestExists(userId, dto.interestId);
    }

    return this.prisma.inputItem.create({
      data: {
        userId,
        interestId: dto.interestId ?? null,
        title: dto.title.trim(),
        kind: dto.kind ?? 'book',
        source: normalizeText(dto.source),
        status: dto.status ?? 'queued',
        progress: normalizeText(dto.progress),
        minutes: dto.minutes ?? 0,
        takeaway: normalizeText(dto.takeaway),
      },
    });
  }

  async createKnowledge(dto: CreateKnowledgeDto): Promise<Knowledge> {
    const userId = await this.currentUser.ensureUserId();

    if (dto.sourceInputId) {
      await this.assertInputExists(userId, dto.sourceInputId);
    }

    return this.prisma.knowledge.create({
      data: {
        userId,
        sourceInputId: dto.sourceInputId ?? null,
        statement: dto.statement.trim(),
        topic: normalizeText(dto.topic),
        confidence: dto.confidence ?? DEFAULT_KNOWLEDGE_CONFIDENCE,
      },
    });
  }

  async createSkill(dto: CreateSkillDto): Promise<Skill> {
    const userId = await this.currentUser.ensureUserId();

    return this.prisma.skill.create({
      data: {
        userId,
        name: dto.name.trim(),
        color: normalizeText(dto.color),
        evidence: dto.evidence ?? [],
      },
    });
  }

  async update(
    kind: MapKind,
    id: string,
    dto: UpdateMapItemDto,
  ): Promise<Focus | Interest | InputItem | Knowledge | Skill> {
    switch (kind) {
      case MapKind.Focus:
        return this.updateFocus(id, dto);
      case MapKind.Interest:
        return this.updateInterest(id, dto);
      case MapKind.Input:
        return this.updateInput(id, dto);
      case MapKind.Knowledge:
        return this.updateKnowledge(id, dto);
      case MapKind.Skill:
        return this.updateSkill(id, dto);
    }
  }

  async remove(kind: MapKind, id: string): Promise<{ id: string }> {
    const userId = await this.currentUser.ensureUserId();
    const where = { id, userId };

    const { count } = await this.deleteById(kind, where);

    if (count === 0) {
      throw new NotFoundException('条目不存在（可能已被删除）');
    }

    return { id };
  }

  /**
   * 用户确认候选后落库（`POST /api/map/candidates/apply`）。
   *
   * 同批次内的关联（兴趣 → 关注点、输入 → 兴趣、知识 → 输入）按名字匹配挂上；
   * 技能同名时视为已存在，跳过而不是重复创建。
   */
  async applyCandidates(
    candidates: CandidatesDto,
  ): Promise<ApplyCandidatesResult> {
    const userId = await this.currentUser.ensureUserId();
    const created: Record<MapKind, number> = {
      focus: 0,
      interest: 0,
      input: 0,
      knowledge: 0,
      skill: 0,
    };
    const skipped = { skill: 0 };

    await this.prisma.$transaction(
      async (tx) => {
        const focusIdByTitle = new Map<string, string>();

        for (const item of dedupeBy(candidates.focus ?? [], (c) => c.title)) {
          const row = await tx.focus.create({
            data: {
              userId,
              title: item.title.trim(),
              why: normalizeText(item.why),
              intensity: item.intensity ?? 3,
            },
          });
          focusIdByTitle.set(matchKey(row.title), row.id);
          created.focus += 1;
        }

        const interestIdByName = new Map<string, string>();

        for (const item of dedupeBy(candidates.interest ?? [], (c) => c.name)) {
          const row = await tx.interest.create({
            data: {
              userId,
              name: item.name.trim(),
              status: item.status ?? 'curious',
              triedWhat: normalizeText(item.triedWhat),
              focusId: lookupBy(focusIdByTitle, item.focusTitle),
            },
          });
          interestIdByName.set(matchKey(row.name), row.id);
          created.interest += 1;
        }

        const inputIdByTitle = new Map<string, string>();

        for (const item of dedupeBy(candidates.input ?? [], (c) => c.title)) {
          const row = await tx.inputItem.create({
            data: {
              userId,
              title: item.title.trim(),
              kind: item.kind ?? 'book',
              source: normalizeText(item.source),
              status: item.status ?? 'queued',
              progress: normalizeText(item.progress),
              takeaway: normalizeText(item.takeaway),
              interestId: lookupBy(interestIdByName, item.interestName),
            },
          });
          inputIdByTitle.set(matchKey(row.title), row.id);
          created.input += 1;
        }

        for (const item of dedupeBy(
          candidates.knowledge ?? [],
          (c) => c.statement,
        )) {
          await tx.knowledge.create({
            data: {
              userId,
              statement: item.statement.trim(),
              topic: normalizeText(item.topic),
              // AI 的 confidence 是「归类把握」，不是「掌握程度」，落库时用默认值
              confidence: DEFAULT_KNOWLEDGE_CONFIDENCE,
              sourceInputId: lookupBy(inputIdByTitle, item.inputTitle),
            },
          });
          created.knowledge += 1;
        }

        for (const item of dedupeBy(candidates.skill ?? [], (c) => c.name)) {
          const existing = await tx.skill.findFirst({
            where: { userId, name: item.name.trim() },
            select: { id: true },
          });

          if (existing) {
            skipped.skill += 1;
            continue;
          }

          await tx.skill.create({
            data: {
              userId,
              name: item.name.trim(),
              evidence: item.evidence ?? [],
            },
          });
          created.skill += 1;
        }
      },
      { timeout: APPLY_TRANSACTION_TIMEOUT_MS },
    );

    return { created, skipped };
  }

  private async updateFocus(
    id: string,
    dto: UpdateMapItemDto,
  ): Promise<Focus> {
    const userId = await this.currentUser.ensureUserId();
    this.assertAllowedFields(MapKind.Focus, dto);

    const data: Prisma.FocusUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.why !== undefined) data.why = normalizeText(dto.why);
    if (dto.intensity !== undefined) data.intensity = dto.intensity;
    if (dto.status !== undefined) data.status = this.assertStatus(dto.status, MapKind.Focus);
    if (dto.reviewAt !== undefined) {
      data.reviewAt = parseDateOrNull(dto.reviewAt, 'reviewAt');
    }

    return this.runUpdate(
      this.prisma.focus.update({ where: { id, userId }, data: assertNotEmpty(data) }),
    );
  }

  private async updateInterest(
    id: string,
    dto: UpdateMapItemDto,
  ): Promise<Interest> {
    const userId = await this.currentUser.ensureUserId();
    this.assertAllowedFields(MapKind.Interest, dto);

    if (dto.focusId) {
      await this.assertFocusExists(userId, dto.focusId);
    }

    const data: Prisma.InterestUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.status !== undefined) {
      data.status = this.assertStatus(dto.status, MapKind.Interest);
    }
    if (dto.triedWhat !== undefined) data.triedWhat = normalizeText(dto.triedWhat);
    if (dto.color !== undefined) data.color = normalizeText(dto.color);
    if (dto.focusId !== undefined) data.focusId = dto.focusId;

    return this.runUpdate(
      this.prisma.interest.update({ where: { id, userId }, data: assertNotEmpty(data) }),
    );
  }

  private async updateInput(
    id: string,
    dto: UpdateMapItemDto,
  ): Promise<InputItem> {
    const userId = await this.currentUser.ensureUserId();
    this.assertAllowedFields(MapKind.Input, dto);

    if (dto.interestId) {
      await this.assertInterestExists(userId, dto.interestId);
    }

    const data: Prisma.InputItemUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.source !== undefined) data.source = normalizeText(dto.source);
    if (dto.status !== undefined) {
      data.status = this.assertStatus(dto.status, MapKind.Input);
    }
    if (dto.progress !== undefined) data.progress = normalizeText(dto.progress);
    if (dto.minutes !== undefined) data.minutes = dto.minutes;
    if (dto.takeaway !== undefined) data.takeaway = normalizeText(dto.takeaway);
    if (dto.interestId !== undefined) data.interestId = dto.interestId;

    return this.runUpdate(
      this.prisma.inputItem.update({ where: { id, userId }, data: assertNotEmpty(data) }),
    );
  }

  private async updateKnowledge(
    id: string,
    dto: UpdateMapItemDto,
  ): Promise<Knowledge> {
    const userId = await this.currentUser.ensureUserId();
    this.assertAllowedFields(MapKind.Knowledge, dto);

    if (dto.sourceInputId) {
      await this.assertInputExists(userId, dto.sourceInputId);
    }

    const data: Prisma.KnowledgeUncheckedUpdateInput = {};
    if (dto.statement !== undefined) data.statement = dto.statement.trim();
    if (dto.topic !== undefined) data.topic = normalizeText(dto.topic);
    if (dto.confidence !== undefined) data.confidence = dto.confidence;
    if (dto.lastCheckedAt !== undefined) {
      data.lastCheckedAt = parseDateOrNull(dto.lastCheckedAt, 'lastCheckedAt');
    }
    if (dto.sourceInputId !== undefined) data.sourceInputId = dto.sourceInputId;

    return this.runUpdate(
      this.prisma.knowledge.update({ where: { id, userId }, data: assertNotEmpty(data) }),
    );
  }

  private async updateSkill(
    id: string,
    dto: UpdateMapItemDto,
  ): Promise<Skill> {
    const userId = await this.currentUser.ensureUserId();
    this.assertAllowedFields(MapKind.Skill, dto);

    const data: Prisma.SkillUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.color !== undefined) data.color = normalizeText(dto.color);
    if (dto.level !== undefined) data.level = dto.level;
    if (dto.xp !== undefined) data.xp = dto.xp;
    if (dto.evidence !== undefined) data.evidence = dto.evidence;
    if (dto.lastPracticedAt !== undefined) {
      data.lastPracticedAt = parseDateOrNull(dto.lastPracticedAt, 'lastPracticedAt');
    }

    return this.runUpdate(
      this.prisma.skill.update({ where: { id, userId }, data: assertNotEmpty(data) }),
    );
  }

  private deleteById(
    kind: MapKind,
    where: { id: string; userId: string },
  ): Promise<{ count: number }> {
    switch (kind) {
      case MapKind.Focus:
        return this.prisma.focus.deleteMany({ where });
      case MapKind.Interest:
        return this.prisma.interest.deleteMany({ where });
      case MapKind.Input:
        return this.prisma.inputItem.deleteMany({ where });
      case MapKind.Knowledge:
        return this.prisma.knowledge.deleteMany({ where });
      case MapKind.Skill:
        return this.prisma.skill.deleteMany({ where });
    }
  }

  /** Prisma 用 `P2025` 表示「要改的记录不存在」，这里翻译成 404。 */
  private async runUpdate<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundException('条目不存在（可能已被删除）');
      }
      throw error;
    }
  }

  private assertAllowedFields(kind: MapKind, dto: UpdateMapItemDto): void {
    const allowed = new Set<string>(UPDATE_FIELDS[kind]);
    const unexpected = Object.entries(dto)
      .filter(([key, value]) => value !== undefined && !allowed.has(key))
      .map(([key]) => key);

    if (unexpected.length > 0) {
      throw new BadRequestException(
        `「${kind}」不接受字段：${unexpected.join('、')}`,
      );
    }
  }

  private assertStatus(status: string, kind: MapKind): string {
    const allowed = STATUSES_BY_KIND[kind];

    if (allowed && !allowed.includes(status)) {
      throw new BadRequestException(
        `「${kind}」的 status 只能是：${allowed.join(' / ')}`,
      );
    }

    return status;
  }

  private async assertFocusExists(
    userId: string,
    focusId: string,
  ): Promise<void> {
    const focus = await this.prisma.focus.findFirst({
      where: { id: focusId, userId },
      select: { id: true },
    });

    if (!focus) {
      throw new BadRequestException('关注点不存在');
    }
  }

  private async assertInterestExists(
    userId: string,
    interestId: string,
  ): Promise<void> {
    const interest = await this.prisma.interest.findFirst({
      where: { id: interestId, userId },
      select: { id: true },
    });

    if (!interest) {
      throw new BadRequestException('兴趣不存在');
    }
  }

  private async assertInputExists(
    userId: string,
    inputId: string,
  ): Promise<void> {
    const input = await this.prisma.inputItem.findFirst({
      where: { id: inputId, userId },
      select: { id: true },
    });

    if (!input) {
      throw new BadRequestException('输入素材不存在');
    }
  }
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function truncate(value: string): string {
  return value.length > SUMMARY_TEXT_LIMIT
    ? `${value.slice(0, SUMMARY_TEXT_LIMIT)}…`
    : value;
}

function parseDateOrNull(
  value: string | null | undefined,
  field: string,
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} 需要是合法的 ISO 时间字符串`);
  }

  return date;
}

function assertNotEmpty<T extends object>(data: T): T {
  if (Object.keys(data).length === 0) {
    throw new BadRequestException('没有需要更新的字段');
  }

  return data;
}

/** 去掉同名/同标题的重复项，避免「全部确认」时把同一件事写两遍。 */
function dedupeBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = matchKey(keyOf(item));

    if (key.length === 0 || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/** 按名字在**同批次**已创建的条目里找 id，找不到就返回 null（不强求挂靠）。 */
function lookupBy(map: Map<string, string>, name: string | null | undefined): string | null {
  return name ? (map.get(matchKey(name)) ?? null) : null;
}

function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}
