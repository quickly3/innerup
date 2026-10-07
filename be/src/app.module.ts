import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { GrowthModule } from './growth/growth.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    // 读取 be/.env，全局可注入 ConfigService
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    GrowthModule,
  ],
  providers: [
    // 全局管道 / 拦截器 / 过滤器统一在此注册（而非 main.ts 里的 useGlobal*），
    // 好处：e2e 测试用 createNestApplication() 时同样生效。
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
