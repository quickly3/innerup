// 必须是第一个 import：在 AppModule / PrismaService 读取 process.env 之前加载 be/.env
import './load-env.js';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';

const DEFAULT_PORT = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin:
      process.env.CORS_ORIGIN?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? true,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('InnerUp API')
    .setDescription('以 AI 为教练的自我提升游戏化系统')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API 已启动：http://localhost:${port}/api`);
  logger.log(`健康检查：http://localhost:${port}/api/health`);
  logger.log(`接口文档：http://localhost:${port}/docs`);
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error('启动失败', error as Error);
  process.exit(1);
});
