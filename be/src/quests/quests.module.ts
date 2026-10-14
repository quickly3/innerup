import { Module } from '@nestjs/common';

import { CurrentUserService } from '../common/current-user.service.js';
import { QuestsController } from './quests.controller.js';
import { QuestsService } from './quests.service.js';

/** 任务：手动 CRUD 与状态流转（《项目规划》第 3.4 节 · M3；打卡在 M5）。 */
@Module({
  controllers: [QuestsController],
  providers: [QuestsService, CurrentUserService],
  exports: [QuestsService],
})
export class QuestsModule {}
