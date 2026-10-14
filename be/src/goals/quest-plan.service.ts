import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AiUnavailableError } from '../ai/ai.errors.js';
import { AiService } from '../ai/ai.service.js';
import {
  buildGenerateQuestsUserPrompt,
  GENERATE_QUESTS_SYSTEM_PROMPT,
  type QuestPlanMapSummary,
  type QuestPlanRequest,
} from '../ai/prompts/generate-quests.prompt.js';
import {
  generateQuestsResultSchema,
  type PlannedQuest,
} from '../ai/schemas/generate-quests.schema.js';
import type { Prisma, Quest } from '../generated/prisma/client.js';
import { CurrentUserService } from '../common/current-user.service.js';
import { normalizeText } from '../common/prisma-utils.js';
import { GrowthService } from '../growth/growth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GenerateQuestsDto } from './dto/generate-quests.dto.js';
import {
  DEFAULT_QUEST_PLAN_MODE,
  MAX_PLANNED_QUESTS,
  PLAN_TRANSACTION_TIMEOUT_MS,
  QUEST_ORDER_STEP,
} from './goals.constants.js';
import { buildFallbackQuests } from './quest-plan.template.js';
import type { GeneratedQuestPlan, QuestPlanSource } from './goals.types.js';

/**
 * 「AI 生成任务线」链路（《项目规划》第 8.1 节 · M4）。
 *
 * 一次调用 = 目标 + 当前水平 + 每周可投入时间 + **档案快照**（第 13.2 节：判断该补链条的哪一段）
 * → 结构化任务列表 → 直接落库（`append` 追加 / `replace` 重来）。
 * AI 不可用时**不报错**，改用代码里的通用模板兜底（第 8.2 节：结果缓存 / 降级），
 * 并在响应里标注 `source: 'template'`，让前端明确告诉用户「这不是 AI 生成的」。
 */
@Injectable()
export class QuestPlanService {
  private readonly logger = new Logger(QuestPlanService.name);

  constructor(
    private readonly ai: AiService,
    private readonly growth: GrowthService,
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  async generate(
    goalId: string,
    dto: GenerateQuestsDto,
  ): Promise<GeneratedQuestPlan> {
    const userId = await this.currentUser.ensureUserId();

    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true, title: true, description: true },
    });

    if (!goal) {
      throw new NotFoundException('目标不存在（可能已被删除）');
    }

    const map = await this.growth.questPlanSummary();
    const planned = await this.plan(
      {
        goalTitle: goal.title,
        goalDescription: goal.description,
        currentLevel: normalizeText(dto.currentLevel),
        weeklyHours: dto.weeklyHours ?? null,
        map,
      },
      map,
    );

    const mode = dto.mode ?? DEFAULT_QUEST_PLAN_MODE;
    const { created, replaced } = await this.persist(
      goalId,
      planned.quests,
      mode,
    );

    // 只记条数与来源，不打印用户目标原文（隐私：见《项目规划》第 13.9 节）
    this.logger.log(
      `生成任务线：目标 ${goalId} → 落库 ${created.length} 条（来源 ${planned.source}，${mode}，清掉 ${replaced} 条待开始）`,
    );

    return {
      goalId,
      suggestedTitle:
        planned.goalTitle && planned.goalTitle !== goal.title
          ? planned.goalTitle
          : null,
      created,
      replaced,
      source: planned.source,
      meta: {
        mapItems: countMapItems(map),
        weeklyHours: dto.weeklyHours ?? null,
      },
    };
  }

  /**
   * 调模型 + Zod 二次校验。
   *
   * AI 不可用（未配 Key / 上游抖动 / 输出始终不合约定）时**不返回错误**，
   * 改用通用模板兜底并标注来源——核心闭环不能因为模型的问题卡死（第 8.2 节）。
   */
  private async plan(
    request: QuestPlanRequest,
    map: QuestPlanMapSummary,
  ): Promise<{
    goalTitle: string | null;
    quests: PlannedQuest[];
    source: QuestPlanSource;
  }> {
    try {
      const result = await this.ai.completeJson({
        system: GENERATE_QUESTS_SYSTEM_PROMPT,
        user: buildGenerateQuestsUserPrompt(request),
        schema: generateQuestsResultSchema,
        maxTokens: 4000,
      });

      // 档案为空时提示用户去补档案：没有档案的任务线只能给通用路径
      if (countMapItems(map) === 0) {
        this.logger.warn('生成任务线时用户档案为空，只能按通用路径生成');
      }

      // 条数上限：模型偶尔多给几条，落库前裁掉（schema 已保证至少 1 条）
      return {
        ...result,
        quests: result.quests.slice(0, MAX_PLANNED_QUESTS),
        source: 'ai',
      };
    } catch (error) {
      if (error instanceof AiUnavailableError) {
        this.logger.warn(
          `AI 生成任务线失败，改用通用模板兜底：${error.message}`,
        );

        return {
          goalTitle: null,
          quests: buildFallbackQuests(request.goalTitle),
          source: 'template',
        };
      }

      throw error;
    }
  }

  /**
   * 落库：`replace` 先清掉还没开始的任务（在做 / 已完成的任务与打卡记录不动），
   * 然后从当前最大 `order` 往后按步长排下去——与手动创建任务用的是同一套排序口径。
   */
  private async persist(
    goalId: string,
    quests: PlannedQuest[],
    mode: string,
  ): Promise<{ created: Quest[]; replaced: number }> {
    return this.prisma.$transaction(
      async (tx) => {
        let replaced = 0;

        if (mode === 'replace') {
          const { count } = await tx.quest.deleteMany({
            where: { goalId, status: 'todo' },
          });
          replaced = count;
        }

        const last = await tx.quest.findFirst({
          where: { goalId },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        let order = (last?.order ?? 0) + QUEST_ORDER_STEP;

        const created: Quest[] = [];

        for (const item of quests) {
          created.push(
            await tx.quest.create({
              data: {
                goalId,
                title: item.title,
                description: composeDescription(item),
                kind: item.kind,
                difficulty: item.difficulty,
                xpReward: item.xpReward,
                estMinutes: item.estMinutes,
                order,
              } satisfies Prisma.QuestUncheckedCreateInput,
            }),
          );
          order += QUEST_ORDER_STEP;
        }

        return { created, replaced };
      },
      { timeout: PLAN_TRANSACTION_TIMEOUT_MS },
    );
  }
}

/**
 * `acceptance` 不单独建列（M4 不改表结构），落库时并进 `description`——
 * 与前端「怎么做 / 验收标准」那一个输入框的口径一致（《项目规划》第 7 节）。
 */
function composeDescription(quest: PlannedQuest): string | null {
  const parts = [
    quest.description,
    quest.acceptance ? `验收标准：${quest.acceptance}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join('\n') : null;
}

function countMapItems(map: QuestPlanMapSummary): number {
  return (
    map.focus.length +
    map.interest.length +
    map.input.length +
    map.knowledge.length +
    map.skill.length
  );
}
