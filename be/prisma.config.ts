import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma ORM v7 配置。
 *
 * v7 起数据库连接串不再写在 `schema.prisma` 的 `datasource` 块里，
 * 而是集中在本文件。`.env` 需要显式加载（Prisma 不再自动读取）。
 *
 * 注意事项：
 * - 这里刻意用 `process.env.X ?? ''` 而不是 `env('X')`。
 *   `env()` 在变量缺失时会直接抛错，导致 `prisma generate` 这类
 *   **不需要数据库连接**的命令也无法执行（比如 CI 里只做类型检查时）。
 * - 迁移（migrate）会用到 `url`；连接池托管商（Neon / Supabase）请把
 *   直连地址填进 `DATABASE_URL`，或额外提供 `SHADOW_DATABASE_URL`。
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
});
