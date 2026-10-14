import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_QUEST_DIFFICULTY,
  DEFAULT_QUEST_KIND,
  DEFAULT_QUEST_XP,
  MAX_PAGE_SIZE,
  QUEST_KINDS,
  QUEST_STATUSES,
} from '../../goals/goals.constants.js';

/** `GET /api/quests` 的查询参数。 */
export class QuestListQueryDto {
  @ApiPropertyOptional({ description: '只看某个任务线下的任务' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  goalId?: string;

  @ApiPropertyOptional({ enum: QUEST_STATUSES })
  @IsOptional()
  @IsIn(QUEST_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: QUEST_KINDS })
  @IsOptional()
  @IsIn(QUEST_KINDS)
  kind?: string;

  @ApiPropertyOptional({
    enum: ['today'],
    description:
      '`today` 表示只看今天到期或今天已完成的（《项目规划》第 6 节）',
  })
  @IsOptional()
  @IsIn(['today'])
  date?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: '从 1 开始' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

/** `POST /api/quests` 的请求体：手动创建任务（M4 的 AI 生成走另一条链路）。 */
export class CreateQuestDto {
  @ApiProperty({ description: '所属目标（任务线）id' })
  @IsString()
  @MinLength(1)
  goalId!: string;

  @ApiProperty({ example: '练熟 C / G / Am 三个和弦', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: '怎么做 / 验收标准', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    enum: QUEST_KINDS,
    default: DEFAULT_QUEST_KIND,
    description: 'input 输入 / practice 练习 / output 产出，任务线要两者交替',
  })
  @IsOptional()
  @IsIn(QUEST_KINDS)
  kind?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    default: DEFAULT_QUEST_DIFFICULTY,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000, default: DEFAULT_QUEST_XP })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  xpReward?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 10_000,
    description: '预计投入分钟数',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  estMinutes?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description: '排序；不传则排在该目标末尾',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  order?: number;

  @ApiPropertyOptional({ description: 'ISO 时间；传 null 清空截止时间' })
  @IsOptional()
  @IsString()
  dueDate?: string | null;
}

/** `PATCH /api/quests/:id` 的请求体：状态流转与排序都在这里。 */
export class UpdateQuestDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 1000,
    description: '传 null 清空',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: QUEST_STATUSES,
    description: 'todo → doing → done',
  })
  @IsOptional()
  @IsIn(QUEST_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: QUEST_KINDS })
  @IsOptional()
  @IsIn(QUEST_KINDS)
  kind?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  xpReward?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10_000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  estMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, description: '调整顺序' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  order?: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'ISO 时间；传 null 清空',
  })
  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    description: '换到另一个任务线（M3 页面暂未开放，保留字段）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  goalId?: string;
}
