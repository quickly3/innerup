import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/**
 * 全局 Prisma 模块：其他模块无需重复 import 即可注入 `PrismaService`。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
