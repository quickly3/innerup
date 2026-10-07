import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
 * 手动新增（《项目规划》第 13.8 节）与 AI 失败时的降级入口（第 13.9 节）。
 * 结构与「候选」的区别：没有 `confidence` / `reason`（那是 AI 的元信息），
 * 但可以指定关联（`focusId` / `interestId` / `sourceInputId`）。
 */

export class CreateFocusDto {
  @ApiProperty({ example: '想转岗做数据', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ description: '动机：为什么在意' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  why?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  intensity?: number;

  @ApiPropertyOptional({
    enum: FOCUS_STATUSES,
    default: 'active',
    description: '到期未动时 AI 会问「还在意吗」（M9）',
  })
  @IsOptional()
  @IsIn(FOCUS_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: 'ISO 时间；下次回看时间' })
  @IsOptional()
  @IsString()
  reviewAt?: string;
}

export class CreateInterestDto {
  @ApiProperty({ example: '弹吉他', maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({ enum: INTEREST_STATUSES, default: 'curious' })
  @IsOptional()
  @IsIn(INTEREST_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: '试过什么' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  triedWhat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ description: '所属关注点 id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  focusId?: string;
}

export class CreateInputDto {
  @ApiProperty({ example: '《数据分析实战》', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ enum: INPUT_KINDS, default: 'book' })
  @IsOptional()
  @IsIn(INPUT_KINDS)
  kind?: string;

  @ApiPropertyOptional({ description: '作者 / 链接' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  @ApiPropertyOptional({ enum: INPUT_STATUSES, default: 'queued' })
  @IsOptional()
  @IsIn(INPUT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ example: '第 3 章 / 45%' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  progress?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  minutes?: number;

  @ApiPropertyOptional({ description: '一句话收获（消化出口之一）' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  takeaway?: string;

  @ApiPropertyOptional({ description: '所属兴趣 id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  interestId?: string;
}

export class CreateKnowledgeDto {
  @ApiProperty({ example: '留存率要按同期群拆开看', maxLength: 300 })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  statement!: string;

  @ApiPropertyOptional({ example: '数据分析' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  topic?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  confidence?: number;

  @ApiPropertyOptional({ description: '来自哪条输入 id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceInputId?: string;
}

export class CreateSkillDto {
  @ApiProperty({ example: '拉漏斗查询', maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ type: [String], description: '产出物：链接 / 文件 / 打卡 id' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  evidence?: string[];
}
