# InnerUp 后端（be/）

NestJS + Prisma (v7) 后端服务。

- 使用 ESM、NestJS 12 + Vitest
- Prisma 7 使用 `prisma.config.ts` 来配置数据源
- Prisma client 生成到 `be/src/generated/prisma`

## 快速开始

1. 安装依赖：

```bash
cd be
npm install
```

2. 填写环境变量（`be/.env`）：

- `DATABASE_URL`：PostgreSQL 连接串（Neon/Supabase/Railway）
- `PORT`：服务端口，默认 `3000`
- `AI_API_KEY`：档案归类 / 生成任务线用的模型 Key（不填则 AI 功能降级，不报错崩溃）
- `GITHUB_TOKEN`：**可选**，只用于「GitHub 地址录入」（读账号公开资料卡与公开仓库 README）。不填时未认证额度 60 次/小时、最多读 6 个仓库；填了最多读 12 个仓库

示例参见 `.env.example`。

3. 生成 Prisma client（`prisma generate` 在 `postinstall` 已自动触发）：

```bash
npx prisma generate
```

4. 运行开发服务器：

```bash
npm run start:dev
```

5. 查看 Swagger 文档：

`http://localhost:3000/docs`

## 数据库迁移

`prisma/schema.prisma` 是数据模型的事实来源（对应[《项目规划》第 7 节 · 数据模型](../docs/项目规划/07-数据模型.md)），
迁移文件提交在 `be/prisma/migrations/`（首次为 `20261007060913_init`：
User / Skill / Goal / Quest / CheckIn / Review / Achievement）。

改动 schema 后：

```bash
npm run prisma:migrate   # 开发：生成迁移并应用（prisma migrate dev）
npm run prisma:deploy    # 部署：只应用已提交的迁移（prisma migrate deploy）
npm run prisma:studio    # 可视化查看数据
```

注意：

- `prisma migrate dev` 需要 **shadow database**；账号没有建库权限时会报 `P3014`，
  这时在 `be/.env` 里补上 `SHADOW_DATABASE_URL` 即可。
- 迁移用的连接串建议填**直连地址**（Neon 上带 `-pooler` 的是连接池地址，迁移会失败）。

## 主要约定

- 统一响应体：所有控制器返回 `ApiResponse<T>` 格式 `{ code, data, message }`。
  - 成功：`code === 0`，`data` 为业务对象。
  - 失败：`code === HTTP 状态码`，`data === null`。
- 全局拦截器 `TransformInterceptor` 自动把返回值包装成 `ApiResponse`。
- 全局异常过滤器 `AllExceptionsFilter` 将任意异常转成统一错误结构。
- PrismaService：使用 `@prisma/adapter-pg` 创建 `PrismaClient`，并提供 `ping()` 探活方法。
- 健康检查：`GET /api/health` 返回服务与数据库状态（数据库不可用也返回 200）
- 个人档案录入（M2.5）：`POST /api/map/ingest`（文本）/ `ingest/pdf`（PDF）/ `ingest/github`（GitHub 账号资料卡 + 公开仓库 README）
  - 三种入口共用同一条 AI 归类链路，都**只返回候选**，需 `POST /api/map/candidates/apply` 确认落库
  - GitHub 入口由 `github-url.ts` 解析出 `owner` / `repo`，请求固定打到 `https://api.github.com`（防 SSRF）；资料卡读失败不影响 README 分析；上限见 `src/growth/growth.constants.ts`
  - 隐私：PDF / 资料卡 / README 都不落盘，日志只记仓库名与字数

## 常用脚本

- `npm run start:dev`：开发启动（watch）
- `npm run build`：TypeScript 编译到 `dist/`
- `npm run start:prod`：运行 `dist` 下的产物
- `npm run prisma:generate`：生成 Prisma client
- `npm run prisma:migrate`：运行迁移（开发）
- `npm run prisma:deploy`：应用已提交的迁移（部署）
- `npm run prisma:studio`：打开 `prisma studio`

## 注意

- 如果 `npm install` 报错并提示 `arborist` / `edgesOut`，请加 `--legacy-peer-deps`：
  `npm install --legacy-peer-deps`。

- `prisma.config.ts` 会从 `be/.env` 读取 `DATABASE_URL`；CI 中若不想依赖数据库，
  可把 `DATABASE_URL` 设为空，Prisma 服务会在 `onModuleInit` 跳过连接，但 `prisma generate` 仍然可用。
