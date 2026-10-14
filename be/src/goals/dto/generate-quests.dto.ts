import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  DEFAULT_QUEST_PLAN_MODE,
  MAX_WEEKLY_HOURS,
  MIN_WEEKLY_HOURS,
  QUEST_PLAN_MODES,
} from '../goals.constants.js';

/** `POST /api/goals/:id/generate` 的请求体：AI 生成任务线（《项目规划》第 8.1 节 · M4）。 */
export class GenerateQuestsDto {
  @ApiPropertyOptional({
    description: '当前水平 / 起点，越具体生成得越贴合',
    example: '零基础，没碰过吉他，每天最多练 30 分钟',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  currentLevel?: string;

  @ApiPropertyOptional({
    minimum: MIN_WEEKLY_HOURS,
    maximum: MAX_WEEKLY_HOURS,
    description: '每周可投入小时数，用来决定任务量与步长',
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_WEEKLY_HOURS)
  @Max(MAX_WEEKLY_HOURS)
  weeklyHours?: number;

  @ApiPropertyOptional({
    enum: QUEST_PLAN_MODES,
    default: DEFAULT_QUEST_PLAN_MODE,
    description:
      '`append` 追加到末尾；`replace` 先清掉还没开始（todo）的任务再写入（在做 / 已完成与打卡记录保留）',
  })
  @IsOptional()
  @IsIn(QUEST_PLAN_MODES)
  mode?: string;
}
