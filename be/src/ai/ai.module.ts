import { Module } from '@nestjs/common';

import { AiService } from './ai.service.js';

/**
 * AI 模块：对外只暴露 `AiService`，把「调模型」与「业务逻辑」解耦
 * （《项目规划》第 8.2 节）。后续 M4 / M6 / M9 的调用点都通过它。
 */
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
