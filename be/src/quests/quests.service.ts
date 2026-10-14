import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Prisma, Quest } from '../generated/prisma/client.js';
import { CurrentUserService } from '../common/current-user.service.js';
import {
  assertNotEmpty,
  isRecordNotFound,
  normalizeText,
  parseDateOrNull,
} from '../common/prisma-utils.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_QUEST_DIFFICULTY,
  DEFAULT_QUEST_KIND,
  DEFAULT_QUEST_XP,
  QUEST_ORDER_STEP,
} from '../goals/goals.constants.js';
import type { QuestListResult } from '../goals/goals.types.js';
import type {
  CreateQuestDto,
  QuestListQueryDto,
  UpdateQuestDto,
} from './dto/quest.dto.js';

/**
 * 任务的读写（《项目规划》第 3.4 / 7 节 · M3）。
 *
 * M3 只做「手动创建 + 列表 + 状态流转」；打卡、XP 结算与热力图在 M5。
 * 任务归属靠 `Quest.goal → Goal.userId` 判断，业务层不信任请求里的 `goalId`。
 */
@Injectable()
export class QuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  async list(query: QuestListQueryDto): Promise<QuestListResult> {
    const userId = await this.currentUser.ensureUserId();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.QuestWhereInput = {
      goal: { userId },
      ...(query.goalId ? { goalId: query.goalId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.date === 'today' ? todayFilter() : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.quest.findMany({
        where,
        // `Quest` 没有 `createdAt`：`order` 不够用时用 `id` 兜底，保证分页稳定
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        skip: pageSize * (page - 1),
        take: pageSize,
      }),
      this.prisma.quest.count({ where }),
    ]);

    return { records, pagination: { page, pageSize, total } };
  }

  async create(dto: CreateQuestDto): Promise<Quest> {
    const userId = await this.currentUser.ensureUserId();
    await this.assertGoalOwned(userId, dto.goalId);

    return this.prisma.quest.create({
      data: {
        goalId: dto.goalId,
        title: dto.title.trim(),
        description: normalizeText(dto.description),
        kind: dto.kind ?? DEFAULT_QUEST_KIND,
        difficulty: dto.difficulty ?? DEFAULT_QUEST_DIFFICULTY,
        xpReward: dto.xpReward ?? DEFAULT_QUEST_XP,
        estMinutes: dto.estMinutes,
        order: dto.order ?? (await this.nextOrder(dto.goalId)),
        dueDate: parseDateOrNull(dto.dueDate, 'dueDate'),
      },
    });
  }

  async update(id: string, dto: UpdateQuestDto): Promise<Quest> {
    const userId = await this.currentUser.ensureUserId();
    await this.assertQuestOwned(userId, id);

    if (dto.goalId !== undefined) {
      await this.assertGoalOwned(userId, dto.goalId);
    }

    const data: Prisma.QuestUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) {
      data.description = normalizeText(dto.description);
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.xpReward !== undefined) data.xpReward = dto.xpReward;
    if (dto.estMinutes !== undefined) data.estMinutes = dto.estMinutes;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.dueDate !== undefined) {
      data.dueDate = parseDateOrNull(dto.dueDate, 'dueDate');
    }
    if (dto.goalId !== undefined) data.goalId = dto.goalId;

    return this.runUpdate(
      this.prisma.quest.update({ where: { id }, data: assertNotEmpty(data) }),
    );
  }

  /** 删除任务：`CheckIn` 的外键是 `onDelete: Cascade`，打卡记录一并删掉。 */
  async remove(id: string): Promise<{ id: string }> {
    const userId = await this.currentUser.ensureUserId();
    await this.assertQuestOwned(userId, id);

    await this.prisma.quest.delete({ where: { id } });

    return { id };
  }

  /** 未显式传 `order` 时排到该目标末尾，且与已有任务保持步长间隔。 */
  private async nextOrder(goalId: string): Promise<number> {
    const last = await this.prisma.quest.findFirst({
      where: { goalId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return (last?.order ?? 0) + QUEST_ORDER_STEP;
  }

  private async assertGoalOwned(userId: string, goalId: string): Promise<void> {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    });

    if (!goal) {
      throw new BadRequestException('目标不存在');
    }
  }

  private async assertQuestOwned(userId: string, id: string): Promise<void> {
    const quest = await this.prisma.quest.findFirst({
      where: { id, goal: { userId } },
      select: { id: true },
    });

    if (!quest) {
      throw new NotFoundException('任务不存在（可能已被删除）');
    }
  }

  private async runUpdate(operation: Promise<Quest>): Promise<Quest> {
    try {
      return await operation;
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundException('任务不存在（可能已被删除）');
      }
      throw error;
    }
  }
}

/**
 * `?date=today` 的定义（`Quest` 没有 `updatedAt`，只能靠 `dueDate` 与 `status` 判断）：
 * 今天到期的 + 手上正在做的 + 逾期未完成的。
 * 「今天完成了什么」要等 M5 的打卡记录（`CheckIn.createdAt`）才准。
 */
function todayFilter(): Prisma.QuestWhereInput {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    OR: [
      { dueDate: { gte: start, lt: end } },
      { status: 'doing' },
      { dueDate: { lt: start }, status: { not: 'done' } },
    ],
  };
}
