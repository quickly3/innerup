import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module.js';
import { CurrentUserService } from '../common/current-user.service.js';
import { GithubReadmeService } from './github-readme.service.js';
import { GrowthController } from './growth.controller.js';
import { GrowthService } from './growth.service.js';
import { MapIngestService } from './map-ingest.service.js';

/** 个人档案 / 成长地图：录入、归类、管理（《项目规划》第 13 节）。 */
@Module({
  imports: [AiModule],
  controllers: [GrowthController],
  providers: [
    GrowthService,
    MapIngestService,
    GithubReadmeService,
    CurrentUserService,
  ],
  exports: [GrowthService],
})
export class GrowthModule {}
