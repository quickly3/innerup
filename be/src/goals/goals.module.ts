import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module.js';
import { CurrentUserService } from '../common/current-user.service.js';
import { GrowthModule } from '../growth/growth.module.js';
import { GoalsController } from './goals.controller.js';
import { GoalsService } from './goals.service.js';
import { QuestPlanService } from './quest-plan.service.js';

/**
 * 目标（任务线）：手动 CRUD（《项目规划》第 3.4 节 · M3）+ AI 生成（M4）。
 *
 * 生成任务线要读档案快照，所以依赖 `GrowthModule`（它 `exports` 了 `GrowthService`）。
 */
@Module({
  imports: [AiModule, GrowthModule],
  controllers: [GoalsController],
  providers: [GoalsService, QuestPlanService, CurrentUserService],
  exports: [GoalsService],
})
export class GoalsModule {}
