import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: '健康检查',
    description:
      '确认服务存活，并顺带探测数据库连通性。数据库不可用时仍返回 200，' +
      '仅在 `database` 字段体现状态，便于前端区分「服务挂了」和「库没连上」。',
  })
  async check() {
    const databaseOk = await this.prisma.ping();

    return {
      status: 'ok',
      database: databaseOk ? 'up' : 'down',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
