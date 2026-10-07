---
name: prisma-change
description: 创建或修改 Prisma schema、数据库结构时参考（InnerUp 版）。事实来源是 be/prisma/schema.prisma，client 生成到 be/src/generated/prisma；DB 变更流程：改 schema -> npm --prefix be run prisma:migrate 生成并应用 migration -> 提交 be/prisma/migrations/；状态/类型字段用 String + 代码层常量，不新增 Prisma enum；执行任何迁移前必须先征得用户同意。
---

# Prisma 创建与修改规范（InnerUp）

## 适用场景

- 新增或修改 `be/prisma/schema.prisma` 中的 model、字段、关系、索引
- 需要调整数据库结构
- 评估某个业务规则应该放在数据库层还是应用 service 层

## 本项目事实（不要照搬其他项目的脚本）

| 项 | 本项目实际值 |
| --- | --- |
| schema 位置 | `be/prisma/schema.prisma`（对应 `docs/项目规划/07-数据模型.md`） |
| 连接串 | `be/prisma.config.ts` 读 `be/.env` 的 `DATABASE_URL`；**Prisma 7 起不写在 schema 里** |
| client 输出 | `be/src/generated/prisma`，**不要手改生成物**，类型从 `../generated/prisma/client.js` 导入 |
| 客户端创建 | Prisma 7 必须用 driver adapter（`PrismaPg`），见 `be/src/prisma/prisma.service.ts` |
| migration 目录 | `be/prisma/migrations/`（随代码提交） |
| seed | **本项目不使用 seed**，不要新增、不要建议运行 |

### 命令（在仓库根目录执行）

```bash
npm run db:migrate                 # = npm --prefix be run prisma:migrate（prisma migrate dev）
npm run db:studio                  # = npm --prefix be run prisma:studio

npm --prefix be run prisma:migrate   # 开发：生成 migration 并应用到数据库
npm --prefix be run prisma:deploy    # 部署：只应用已提交的 migration（prisma migrate deploy）
npm --prefix be run prisma:generate  # 重新生成 Prisma Client（postinstall 也会自动跑）
npm --prefix be run prisma:push      # prisma db push（慎用：不走 migration，仅在明确需要时）
```

> ⚠️ 本仓库**没有** `prisma:m_create` / `prisma:m_deploy` 这类脚本，也不要依赖
> `bash script/migrate-diff.sh`——那是别的项目的约定。

## 权限与安全（与 `safety-guardrails` 一致）

- **AI 不擅自做数据库变更**：`prisma:migrate` / `prisma:deploy` / `prisma:push` 都会改动数据库，
  **执行前必须先向用户说明并取得同意**
- 敏感配置只走环境变量：`DATABASE_URL`、`SHADOW_DATABASE_URL` 放在 `be/.env`，**不提交、不写进代码**

## 标准流程

1. **先定位现有 model 与调用方**
   - 搜索相关 model、DTO、service、controller、脚本
   - 明确字段是否已被 API、报表、定时任务或 CLI 使用
2. **修改 `be/prisma/schema.prisma`**
   - 保持命名与现有 model 风格一致（model 用 PascalCase，字段 camelCase）
   - 字段、index 放在 model 内合适位置，避免打乱阅读顺序
   - 沿用本项目既有模式：模型间关系用 `@relation(fields:, references:, onDelete: Cascade | SetNull)`；
     用户维度查询加 `@@index([userId])`；外键列单独加 `@@index`
   - **状态 / 类型字段用 `String`**，取值在代码层用常量/联合类型表达（参考 `be/src/growth/growth.constants.ts`：
     `MapKind` 枚举 + `FOCUS_STATUSES` 等 `as const` 数组），**不要新增 Prisma `enum`**
   - 可选字段、默认值、nullable 语义要明确
3. **评估约束放置位置**（见下节）
4. **更新应用代码**
   - 同步 DTO、service 查询、返回映射、类型引用
   - 新字段若要写入或展示，确保 API 入参/出参、Swagger、前端 `fe/src/app/core/api/*.service.ts` 同步
5. **生成并应用 migration（先取得用户同意）**
   - `npm --prefix be run prisma:migrate` → 检查 `be/prisma/migrations/<timestamp>_<name>/migration.sql`
   - 确认 DDL 对线上已有数据安全，再决定是否 `prisma:deploy`
6. **更新文档并验证**
   - 同步 `docs/项目规划/07-数据模型.md`（与 `schema.prisma` 保持一致）
   - `npm --prefix be run build` 无新增类型错误；相关 service / 查询路径可运行

## 数据库层适合承载的内容

- 基础字段形态：必要字段、默认值、基础类型、时间戳（`createdAt` / `updatedAt`）
- 查询性能所需索引：`@@index`、`@@unique`、常用筛选/排序字段
- 基础外键关系与级联（本项目已在用 `@relation` + `onDelete: Cascade` / `SetNull`）
- 稳定且不会承载业务流程的唯一性约束（如天然唯一的外部 ID）

## 默认避免放入数据库层的内容

- Prisma `enum`：业务状态、流程状态、类型标识一律用 `String` + 代码层枚举/常量
- 复杂唯一性约束、条件唯一性、动态唯一性
- 依赖上下文的状态流转、时间冲突、容量规则、权限规则
- `CHECK`、trigger、隐式副作用逻辑（本项目**不新增 trigger**）

## 应用层优先承载的内容

- 复杂业务规则、状态流转、权限判断、审批逻辑
- 跨表、跨模块、跨外部系统的业务校验
- 需要清晰错误提示、审计日志、灰度策略或特性开关的逻辑
- 未来可能频繁变化的规则
- 需要单元测试、集成测试、mock 外部依赖的逻辑

## Prisma schema 修改注意事项

- DDL 语义要考虑线上已有数据
- 新增必填字段时优先考虑 nullable、默认值或应用层兼容逻辑，避免直接破坏已有数据
- 删除字段、重命名字段、修改类型前确认所有读写路径
- 大表索引、批量数据修复、锁表风险需要在说明里点出来
- 迁移用的连接串建议填**直连地址**；Neon 上带 `-pooler` 的是连接池地址，迁移会失败
- `prisma migrate dev` 需要 **shadow database**，账号没有建库权限会报 `P3014`，
  此时在 `be/.env` 补 `SHADOW_DATABASE_URL`（`be/prisma.config.ts` 已支持）
- `PrismaService` 连接失败**不让进程崩溃**，只记日志，由 `GET /api/health` 如实报 `database: "up" | "down"`；改这块时保持该行为

## 输出要求（完成定义）

- `schema.prisma` 已按本项目风格修改（关系/索引/`String` 状态字段）
- 未新增 Prisma `enum`、未新增 trigger、未引入 seed
- 相关 DTO / service / 前端类型已同步
- `docs/项目规划/07-数据模型.md` 已同步
- migration 已在**用户同意**后生成，并确认 SQL 对已有数据安全
