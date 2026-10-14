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
  GOAL_STATUSES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../goals.constants.js';

/** `GET /api/goals` 的查询参数：按状态过滤分页。 */
export class GoalListQueryDto {
  @ApiPropertyOptional({
    enum: GOAL_STATUSES,
    description: '不传则返回全部状态',
  })
  @IsOptional()
  @IsIn(GOAL_STATUSES)
  status?: string;

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

/** `POST /api/goals` 的请求体：输入「我想提升 XX」即可。 */
export class CreateGoalDto {
  @ApiProperty({ example: '学会弹吉他', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ description: '想达成什么 / 为什么', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

/** `PATCH /api/goals/:id` 的请求体：标题 / 说明 / 状态。 */
export class UpdateGoalDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: '传 null 清空',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ enum: GOAL_STATUSES })
  @IsOptional()
  @IsIn(GOAL_STATUSES)
  status?: string;
}
