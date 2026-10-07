import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  ValidateNested,
} from 'class-validator';

import {
  INPUT_KINDS,
  INPUT_STATUSES,
  INTEREST_STATUSES,
} from '../growth.constants.js';

/**
 * 「AI 归类候选」的传输结构（《项目规划》第 13.9 节「待确认区」）。
 *
 * 这些字段与 `src/ai/schemas/map-ingest.schema.ts` 一一对应：
 * AI 的 JSON 先过 Zod，再以这个结构返回前端；用户改 / 删 / 换类之后，
 * 用**同样的结构**提交回 `/api/map/candidates/apply` 落库。
 *
 * `confidence` 是 AI 对**归类本身**的把握，不是「掌握程度」——
 * 后者是 `Knowledge.confidence`，落库时按用户自己的判断填（默认 3）。
 */

const CONFIDENCE_API = {
  minimum: 1,
  maximum: 5,
  description: 'AI 对这条归类的把握（1~5，1 = 猜的，5 = 原文写得很明确）',
};

const REASON_API = {
  nullable: true,
  description: '一句归类依据（AI 生成，供用户判断是否要改）',
};

export class FocusCandidateDto {
  @ApiProperty({ example: '想转岗做数据', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ nullable: true, description: '动机：为什么在意' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  why?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  intensity?: number;

  @ApiProperty(CONFIDENCE_API)
  @IsInt()
  @Min(1)
  @Max(5)
  confidence!: number;

  @ApiPropertyOptional(REASON_API)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string | null;
}

export class InterestCandidateDto {
  @ApiProperty({ example: '数据分析', maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({ enum: INTEREST_STATUSES, default: 'curious' })
  @IsOptional()
  @IsIn(INTEREST_STATUSES)
  status?: string;

  @ApiPropertyOptional({ nullable: true, description: '试过什么' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  triedWhat?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: '挂到同批次的哪个关注点（按标题匹配）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  focusTitle?: string | null;

  @ApiProperty(CONFIDENCE_API)
  @IsInt()
  @Min(1)
  @Max(5)
  confidence!: number;

  @ApiPropertyOptional(REASON_API)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string | null;
}

export class InputCandidateDto {
  @ApiProperty({ example: '《数据分析实战》', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ enum: INPUT_KINDS, default: 'book' })
  @IsOptional()
  @IsIn(INPUT_KINDS)
  kind?: string;

  @ApiPropertyOptional({ nullable: true, description: '作者 / 链接' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string | null;

  @ApiPropertyOptional({ enum: INPUT_STATUSES, default: 'queued' })
  @IsOptional()
  @IsIn(INPUT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ nullable: true, example: '第 3 章' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  progress?: string | null;

  @ApiPropertyOptional({ nullable: true, description: '一句话收获' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  takeaway?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: '挂到同批次的哪个兴趣（按名称匹配）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  interestName?: string | null;

  @ApiProperty(CONFIDENCE_API)
  @IsInt()
  @Min(1)
  @Max(5)
  confidence!: number;

  @ApiPropertyOptional(REASON_API)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string | null;
}

export class KnowledgeCandidateDto {
  @ApiProperty({ example: '留存率要按同期群拆开看', maxLength: 300 })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  statement!: string;

  @ApiPropertyOptional({ nullable: true, example: '数据分析' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  topic?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: '来自同批次的哪条输入（按标题匹配）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  inputTitle?: string | null;

  @ApiProperty(CONFIDENCE_API)
  @IsInt()
  @Min(1)
  @Max(5)
  confidence!: number;

  @ApiPropertyOptional(REASON_API)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string | null;
}

export class SkillCandidateDto {
  @ApiProperty({ example: '拉漏斗查询', maxLength: 60 })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({
    type: [String],
    description: '产出物：链接 / 文件 / 打卡 id',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  evidence?: string[];

  @ApiProperty(CONFIDENCE_API)
  @IsInt()
  @Min(1)
  @Max(5)
  confidence!: number;

  @ApiPropertyOptional(REASON_API)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string | null;
}

/** 五类候选的集合，与 AI 的输出结构一致。 */
export class CandidatesDto {
  @ApiPropertyOptional({ type: () => [FocusCandidateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FocusCandidateDto)
  focus?: FocusCandidateDto[];

  @ApiPropertyOptional({ type: () => [InterestCandidateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InterestCandidateDto)
  interest?: InterestCandidateDto[];

  @ApiPropertyOptional({ type: () => [InputCandidateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InputCandidateDto)
  input?: InputCandidateDto[];

  @ApiPropertyOptional({ type: () => [KnowledgeCandidateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => KnowledgeCandidateDto)
  knowledge?: KnowledgeCandidateDto[];

  @ApiPropertyOptional({ type: () => [SkillCandidateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SkillCandidateDto)
  skill?: SkillCandidateDto[];
}

/** `POST /api/map/ingest` 的请求体。 */
export class IngestTextDto {
  @ApiProperty({
    description: '用户粘贴的自我介绍 / 简历 / 笔记',
    minLength: 15,
    maxLength: 20_000,
  })
  @IsString()
  @MinLength(15, { message: '内容太短了，多写几句 AI 才有得归类' })
  @MaxLength(20_000, { message: '内容太长（最多 20000 字），请分几次粘贴' })
  text!: string;
}

/** `POST /api/map/candidates/apply` 的请求体。 */
export class ApplyCandidatesDto {
  @ApiProperty({ type: () => CandidatesDto })
  @ValidateNested()
  @Type(() => CandidatesDto)
  candidates!: CandidatesDto;
}
