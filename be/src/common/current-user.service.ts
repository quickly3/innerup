import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * MVP 阶段免登录：整库只有一个用户（《项目规划》第 4 节「不做多用户」）。
 *
 * 用固定 id 而不是「查不到就建一条」，好处是幂等且不怕并发 —— 以后接入登录时，
 * 只要把 `ensureUserId()` 换成「从请求里取用户」，业务层代码不用动。
 */
export const CURRENT_USER_ID = 'local-user';

@Injectable()
export class CurrentUserService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureUserId(): Promise<string> {
    await this.prisma.user.upsert({
      where: { id: CURRENT_USER_ID },
      update: {},
      create: { id: CURRENT_USER_ID, name: '我' },
    });

    return CURRENT_USER_ID;
  }
}
