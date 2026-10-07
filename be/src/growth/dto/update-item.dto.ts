import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
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
  FOCUS_STATUSES,
  INPUT_KINDS,
  INPUT_STATUSES,
  INTEREST_STATUSES,
} from '../growth.constants.js';

/**
 * `PATCH /api/map/:kind/:id` 的请求体（《项目规划》第 13.8 节）。
 *
 * 因为路径里的 `kind` 是动态的，这里把五类字段放在一个 DTO 里，
 * 由 `GrowthService` 按 `kind` 挑出允许更新的字段：
 * 传了不属于该类的字段会直接 400，免得「改了没生效」这种哑巴 bug。
 */
export class UpdateMapItemDto {
  // ── 关注点 / 输入共有
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  // ── 兴趣 / 技能共有
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  // ── 关注点 / 兴趣 / 输入共有
  @ApiPropertyOptional({
    enum: [...FOCUS_STATUSES, ...INTEREST_STATUSES, ...INPUT_STATUSES],
    description: '取值随 kind 变化，见《项目规划》第 13.3 节',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  // ── 关注点
  @ApiPropertyOptional({ description: '动机：为什么在意' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  why?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  intensity?: number;

  @ApiPropertyOptional({ nullable: true, description: 'ISO 时间；传 null 清空' })
  @IsOptional()
  @IsString()
  reviewAt?: string | null;

  // ── 兴趣
  @ApiPropertyOptional({ description: '试过什么' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  triedWhat?: string | null;

  @ApiPropertyOptional({ description: '所属关注点 id；传 null 解除关联' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  focusId?: string | null;

  // ── 输入
  @ApiPropertyOptional({ enum: INPUT_KINDS })
  @IsOptional()
  @IsIn(INPUT_KINDS)
  kind?: string;

  @ApiPropertyOptional({ description: '作者 / 链接' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string | null;

  @ApiPropertyOptional({ example: '第 3 章 / 45%' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  progress?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  minutes?: number;

  @ApiPropertyOptional({ description: '一句话收获（消化出口之一）' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  takeaway?: string | null;

  @ApiPropertyOptional({ description: '所属兴趣 id；传 null 解除关联' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  interestId?: string | null;

  // ── 知识
  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  statement?: string;

  @ApiPropertyOptional({ example: '数据分析' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  topic?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: '掌握程度 1~5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  confidence?: number;

  @ApiPropertyOptional({ nullable: true, description: 'ISO 时间；传 null 清空' })
  @IsOptional()
  @IsString()
  lastCheckedAt?: string | null;

  @ApiPropertyOptional({ description: '来自哪条输入 id；传 null 解除关联' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceInputId?: string | null;

  // ── 技能
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  level?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  xp?: number;

  @ApiPropertyOptional({ type: [String], description: '产出物：链接 / 文件 / 打卡 id' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  evidence?: string[];

  @ApiPropertyOptional({ nullable: true, description: 'ISO 时间；传 null 清空' })
  @IsOptional()
  @IsString()
  lastPracticedAt?: string | null;
}
