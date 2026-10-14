import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import {
  CreateQuestDto,
  QuestListQueryDto,
  UpdateQuestDto,
} from './dto/quest.dto.js';
import { QuestsService } from './quests.service.js';

/**
 * 任务 CRUD（《项目规划》第 6 节 · M3）。
 *
 * 打卡（`POST /api/quests/:id/checkin`）属 M5，这里只做手动增删改查与状态流转。
 */
@ApiTags('quests')
@Controller('quests')
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get()
  @ApiOperation({
    summary: '任务列表',
    description:
      '支持按 `goalId` / `status` / `kind` 过滤，`?date=today` 取今日任务' +
      '（今天到期 + 正在做 + 逾期未完成）。返回 `data = { records, pagination }`。',
  })
  list(@Query() query: QuestListQueryDto) {
    return this.quests.list(query);
  }

  @Post()
  @ApiOperation({
    summary: '手动创建任务',
    description: '`goalId` 必须是自己的目标；不传 `order` 时排到该任务线末尾。',
  })
  create(@Body() dto: CreateQuestDto) {
    return this.quests.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新任务',
    description:
      '状态流转（`todo → doing → done`）、调整排序、改标题 / 说明 / 类型 / 难度 / 预计时长 / 截止时间。',
  })
  @ApiParam({ name: 'id', description: '任务 id' })
  update(@Param('id') id: string, @Body() dto: UpdateQuestDto) {
    return this.quests.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除任务',
    description: '级联删除该任务的打卡记录（数据库外键 `onDelete: Cascade`）。',
  })
  @ApiParam({ name: 'id', description: '任务 id' })
  remove(@Param('id') id: string) {
    return this.quests.remove(id);
  }
}
