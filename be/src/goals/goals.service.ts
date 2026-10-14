import { Injectable, NotFoundException } from '@nestjs/common';

import type { Goal, Prisma } from '../generated/prisma/client.js';
import { CurrentUserService } from '../common/current-user.service.js';
import {
  assertNotEmpty,
  isRecordNotFound,
  normalizeText,
} from '../common/prisma-utils.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateGoalDto,
  GoalListQueryDto,
  UpdateGoalDto,
} from './dto/goal.dto.js';
import { DEFAULT_PAGE_SIZE } from './goals.constants.js';
import type { GoalDetail, GoalWithCounts, QuestCounts } from './goals.types.js';

/**
 * 目标（任务线）的读写（《项目规划》第 3.4 / 7 节 · M3）。
 *
 * M3 只管手动增删改查；M4 的「AI 生成任务线」会复用 `createGoal` 落库、
 * 复用 `GET /api/goals/:id` 给页面展示。
 */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  /** 列表：带回每个目标的任务进度（总数 / 已完成数）。 */
  async list(query: GoalListQueryDto): Promise<GoalWithCounts[]> {
    const userId = await this.currentUser.ensureUserId();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const goals = await this.prisma.goal.findMany({
      where: { userId, ...(query.status ? { status: query.status } : {}) },
      orderBy: { createdAt: 'desc' },
      skip: pageSize * (page - 1),
      take: pageSize,
      include: { quests: { select: { status: true } } },
    });

    // 用任务状态在应用层算进度，避免为一次统计写额外 SQL
    return goals.map(({ quests, ...goal }) => ({
      ...goal,
      questCounts: countQuests(quests),
    }));
  }

  async detail(id: string): Promise<GoalDetail> {
    const userId = await this.currentUser.ensureUserId();

    const goal = await this.prisma.goal.findFirst({
      where: { id, userId },
      include: {
        // `Quest` 没有 `createdAt`（见《项目规划》第 7 节），用 `order` + `id` 保证稳定排序
        quests: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
      },
    });

    if (!goal) {
      throw new NotFoundException('目标不存在（可能已被删除）');
    }

    return goal;
  }

  async create(dto: CreateGoalDto): Promise<Goal> {
    const userId = await this.currentUser.ensureUserId();

    return this.prisma.goal.create({
      data: {
        userId,
        title: dto.title.trim(),
        description: normalizeText(dto.description),
      },
    });
  }

  async update(id: string, dto: UpdateGoalDto): Promise<Goal> {
    const userId = await this.currentUser.ensureUserId();
    const data: Prisma.GoalUncheckedUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) {
      data.description = normalizeText(dto.description);
    }
    if (dto.status !== undefined) data.status = dto.status;

    return this.runUpdate(
      this.prisma.goal.update({
        where: { id, userId },
        data: assertNotEmpty(data),
      }),
    );
  }

  /** 删除目标：`Quest` 的外键是 `onDelete: Cascade`，任务与打卡一并删掉。 */
  async remove(id: string): Promise<{ id: string }> {
    const userId = await this.currentUser.ensureUserId();

    const { count } = await this.prisma.goal.deleteMany({
      where: { id, userId },
    });

    if (count === 0) {
      throw new NotFoundException('目标不存在（可能已被删除）');
    }

    return { id };
  }

  private async runUpdate(operation: Promise<Goal>): Promise<Goal> {
    try {
      return await operation;
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundException('目标不存在（可能已被删除）');
      }
      throw error;
    }
  }
}

function countQuests(quests: Array<{ status: string }>): QuestCounts {
  return {
    total: quests.length,
    done: quests.filter((quest) => quest.status === 'done').length,
  };
}
