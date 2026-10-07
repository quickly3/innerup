import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Prisma 服务。
 *
 * Prisma v7 起**必须**通过 driver adapter 创建客户端（不再内置查询引擎），
 * 这里使用 `@prisma/adapter-pg` 连接 PostgreSQL。
 *
 * 注意：连接失败**不会**让进程崩溃 —— `onModuleInit` 只记录告警，
 * 由 `/api/health` 把数据库状态如实报出来。这样数据库没配好时，
 * 前端依然能起来、接口依然可访问，方便排查。
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly hasConnectionString: boolean;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL') ?? '';
    super({ adapter: new PrismaPg({ connectionString }) });
    this.hasConnectionString = connectionString.length > 0;
  }

  async onModuleInit(): Promise<void> {
    if (!this.hasConnectionString) {
      this.logger.warn(
        '未检测到 DATABASE_URL，跳过数据库连接（请在 be/.env 中配置远端 PostgreSQL 连接串）',
      );
      return;
    }

    try {
      await this.$connect();
      this.logger.log('PostgreSQL 连接成功');
    } catch (error) {
      this.logger.error(
        `PostgreSQL 连接失败：${(error as Error).message}（/api/health 会返回 database: "down"）`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** 轻量探活：数据库是否可用。不抛异常，仅返回布尔值。 */
  async ping(): Promise<boolean> {
    if (!this.hasConnectionString) {
      return false;
    }

    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
