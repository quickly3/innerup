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
  CreateGoalDto,
  GoalListQueryDto,
  UpdateGoalDto,
} from './dto/goal.dto.js';
import { GenerateQuestsDto } from './dto/generate-quests.dto.js';
import { GoalsService } from './goals.service.js';
import { QuestPlanService } from './quest-plan.service.js';

/**
 * 目标（任务线）CRUD + AI 生成任务线（《项目规划》第 6 节 · M3 / M4）。
 */
@ApiTags('goals')
@Controller('goals')
export class GoalsController {
  constructor(
    private readonly goals: GoalsService,
    private readonly questPlan: QuestPlanService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '目标列表',
    description:
      '按创建时间倒序，带回每个目标的任务进度（`questCounts.total / done`）；' +
      'M3 是简单分页（`page` / `pageSize`，返回数组），任务列表才是标准分页体。',
  })
  list(@Query() query: GoalListQueryDto) {
    return this.goals.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: '目标详情',
    description:
      '含该目标下的全部任务，按 `order` 排序，供详情页渲染任务清单。',
  })
  @ApiParam({ name: 'id', description: '目标 id' })
  detail(@Param('id') id: string) {
    return this.goals.detail(id);
  }

  @Post()
  @ApiOperation({
    summary: '创建目标',
    description:
      '输入「我想提升 XX」即可；任务线由 M4 的 AI 生成接口或手动补充。',
  })
  create(@Body() dto: CreateGoalDto) {
    return this.goals.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新目标（标题 / 说明 / 状态）' })
  @ApiParam({ name: 'id', description: '目标 id' })
  update(@Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.goals.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除目标',
    description:
      '级联删除该目标下的任务与打卡记录（数据库外键 `onDelete: Cascade`）。',
  })
  @ApiParam({ name: 'id', description: '目标 id' })
  remove(@Param('id') id: string) {
    return this.goals.remove(id);
  }

  @Post(':id/generate')
  @ApiOperation({
    summary: 'AI 生成任务线',
    description:
      '按「目标 + 当前水平 + 每周可投入时间 + 档案快照」生成 3~7 条任务并直接入库，' +
      '要求输入与产出交替。`mode=append`（默认）追加到末尾；' +
      '`mode=replace` 先清掉还没开始（todo）的任务再写入，在做 / 已完成的任务与打卡记录保留。' +
      '**AI 不可用时不报错**：改用通用模板兜底并在 `source: "template"` 里标注（《项目规划》第 8.2 节的降级）。',
  })
  @ApiParam({ name: 'id', description: '目标 id' })
  generate(@Param('id') id: string, @Body() dto: GenerateQuestsDto) {
    return this.questPlan.generate(id, dto);
  }
}
