import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { MAX_PDF_BYTES, MapKind } from './growth.constants.js';
import { GrowthService } from './growth.service.js';
import { MapIngestService, type UploadedPdfFile } from './map-ingest.service.js';
import { ApplyCandidatesDto, IngestTextDto } from './dto/candidates.dto.js';
import {
  CreateFocusDto,
  CreateInputDto,
  CreateInterestDto,
  CreateKnowledgeDto,
  CreateSkillDto,
} from './dto/create-item.dto.js';
import { UpdateMapItemDto } from './dto/update-item.dto.js';

/**
 * 个人档案 / 成长地图（《项目规划》第 13.8 节）。
 *
 * 注意与 `/api/profile`（角色卡：等级 / XP / 技能雷达 / streak，M5）区分开：
 * 这里的「档案」指的是成长地图的五类对象。
 */
@ApiTags('map')
@Controller('map')
export class GrowthController {
  constructor(
    private readonly growth: GrowthService,
    private readonly ingest: MapIngestService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '档案快照',
    description:
      '五类对象（关注点 / 兴趣 / 输入 / 知识 / 技能）一次取全，含关联 id；' +
      '前端据此渲染管理区，后续 M4 也用它给 AI 生成任务线做依据。',
  })
  snapshot() {
    return this.growth.snapshot();
  }

  @Post('ingest')
  @ApiOperation({
    summary: '文本录入 → AI 归类',
    description:
      '返回带 confidence 与归类依据的候选，**不直接落库**；' +
      '用户改 / 删 / 换类后再调 `POST /api/map/candidates/apply`。' +
      'AI 不可用时返回 503，前端降级为手动新增。',
  })
  ingestText(@Body() dto: IngestTextDto) {
    return this.ingest.ingestText(dto.text);
  }

  @Post('ingest/pdf')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PDF_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: '上传 PDF → 抽文本 → AI 归类',
    description:
      '只在后端内存解析，不落原始文件；抽不到文本层（扫描件）直接 400 提示粘贴文字，不进模型。',
  })
  ingestPdf(@UploadedFile() file?: UploadedPdfFile) {
    return this.ingest.ingestPdf(file);
  }

  @Post('candidates/apply')
  @ApiOperation({
    summary: '确认候选并落库',
    description:
      '支持部分确认：只传用户留下的那些候选即可。同批次内按名字自动挂好关联；' +
      '同名技能视为已存在并跳过。',
  })
  applyCandidates(@Body() dto: ApplyCandidatesDto) {
    return this.growth.applyCandidates(dto.candidates);
  }

  @Post('focus')
  @ApiOperation({ summary: '手动新增关注点' })
  createFocus(@Body() dto: CreateFocusDto) {
    return this.growth.createFocus(dto);
  }

  @Post('interest')
  @ApiOperation({ summary: '手动新增兴趣' })
  createInterest(@Body() dto: CreateInterestDto) {
    return this.growth.createInterest(dto);
  }

  @Post('input')
  @ApiOperation({ summary: '手动新增输入素材' })
  createInput(@Body() dto: CreateInputDto) {
    return this.growth.createInput(dto);
  }

  @Post('knowledge')
  @ApiOperation({ summary: '手动新增知识条目' })
  createKnowledge(@Body() dto: CreateKnowledgeDto) {
    return this.growth.createKnowledge(dto);
  }

  @Post('skill')
  @ApiOperation({ summary: '手动新增技能（通常由 AI 归类产出）' })
  createSkill(@Body() dto: CreateSkillDto) {
    return this.growth.createSkill(dto);
  }

  @Patch(':kind/:id')
  @ApiParam({ name: 'kind', enum: MapKind })
  @ApiOperation({
    summary: '更新条目状态 / 进度',
    description:
      '只接受该 kind 对应的字段，传了别的字段会 400（不静默忽略）；' +
      '可空字段传 null 表示清空。',
  })
  update(
    @Param('kind', new ParseEnumPipe(MapKind)) kind: MapKind,
    @Param('id') id: string,
    @Body() dto: UpdateMapItemDto,
  ) {
    return this.growth.update(kind, id, dto);
  }

  @Delete(':kind/:id')
  @ApiParam({ name: 'kind', enum: MapKind })
  @ApiOperation({ summary: '删除条目' })
  remove(
    @Param('kind', new ParseEnumPipe(MapKind)) kind: MapKind,
    @Param('id') id: string,
  ) {
    return this.growth.remove(kind, id);
  }
}
