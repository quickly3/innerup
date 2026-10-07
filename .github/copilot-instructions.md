# InnerUp · Copilot 仓库指南

以 AI 为教练、把「自我提升」游戏化的成长系统。核心闭环：

```
发掘兴趣 → 制定任务线 → 执行打卡 → AI 反馈 → 获得 XP 升级 → 回到制定
```

**规划文档是唯一事实来源**：[`docs/项目规划.md`](../docs/项目规划.md) 是索引页，正文按章节拆分在 `docs/项目规划/` 下（`01-一句话定位` … `13-成长地图`）。改产品 / 接口 / 数据模型前，先读对应那一节，不要通读全文。

---

## 仓库结构

前后端分离的 monorepo（根 `package.json` 用 `--prefix` 转发脚本，**没有**用 npm workspaces）：

| 目录 | 内容 |
| --- | --- |
| `fe/` | Angular 22 前端（standalone + Signals，zoneless） |
| `be/` | NestJS 12 + Prisma 7 + PostgreSQL 后端 |
| `docs/项目规划/` | 规划正文，一节一文件 |
| `.github/` | 本文件 + `skills/`（AI 协作规范，见下节） |

子项目详细说明见 [`fe/README.md`](../fe/README.md) 与 [`be/README.md`](../be/README.md)——**改技术细节时同步更新它们**。

## AI 协作规范（`.github/skills/`）

`.github/skills/<name>/SKILL.md` 是按需加载的协作规范，动手前先扫一眼相关的那几个：

| Skill | 什么时候用 |
| --- | --- |
| `ai-wiki` | 找项目知识：**本仓库知识库 = `docs/项目规划/`**，不要新建 `ai-wiki/`；大特性用 `docs/workstreams/` |
| `coding-conventions` | 编码风格、M 阶段命名、bug 文档、UI 选型（本项目 UI 已冻结） |
| `communication-style` | 语言约定：聊天 / 文档 / 注释 / 提交信息用中文，标识符用英文 |
| `controller-service-types` | 新增 controller/service 时的类型抽离（DTO 放 `dto/*.dto.ts`） |
| `create-api` | 新增后端接口的完整流程 |
| `pagination-format` | 分页返回格式（`page / pageSize / total`，`page` 从 1 开始） |
| `prisma-change` | 改 `be/prisma/schema.prisma` 与迁移流程 |
| `regression-checklist` | 每次实现完成后的影响分析与自测清单 |
| `safety-guardrails` | 依赖安装、**数据库变更**、`git push`、删文件等需先征得同意 |
| `git-commit` | 生成规范的中文提交信息 |
| `shell-tools-standard` | shell 工具选择（本机只装了 `rg`，无 ast-grep/jq/yq/fzf） |
| `context7-docs` | 第三方库 / API 文档优先用 Context7 查，别凭记忆硬写 |
| `codex-tool-map` | 仅在读到 Claude Code 工具名时作对照；**本仓库用 Copilot 原生工具** |
| `create-cli` / `postman-sync` | ⚠️ 本项目**暂无** CLI 脚手架与 Postman 同步，动手前先与用户确认 |
| `find-skills` | 需要从外部技能生态找能力时（安装前先征得同意） |

> **冲突时以本文件为准。** 这些 skill 里可能残留其他项目的路径与命令
> （`nest-commander`、`src/application/`、`@Roles`/`RolesGuard`、`script/migrate-diff.sh`、
> `postman/bean-engine.collection.json` 等），本项目实际情况见下文各节。

## 常用命令

```bash
npm run setup        # 安装前后端依赖（be 的 postinstall 会自动 prisma generate）
npm run dev:be       # 后端 watch 启动 → http://localhost:3000（Swagger: /docs）
npm run dev:fe       # 前端启动 → http://localhost:4200（/api 已代理到 3000）
npm run build        # 前后端分别构建
npm test             # 前后端分别跑测试
npm run db:migrate   # prisma migrate dev
npm run db:studio    # prisma studio
```

单侧验证优先用**最小命令**：只改后端就跑 `npm --prefix be run build` / `npm --prefix be run test`，只改前端就跑 `npm --prefix fe run build` / `npm --prefix fe run test`（Vitest）。

---

## 后端约定（`be/`）

### 模块与 ESM

- **ESM 项目**（`"type": "module"`）：**所有相对导入必须带 `.js` 后缀**（如 `import { PrismaService } from '../prisma/prisma.service.js'`），否则构建失败。第三方包不带后缀。
- 一个业务域一个 Module，目录内拆 `*.controller.ts` / `*.service.ts` / `dto/`；跨模块只通过被 `exports` 的 Service 交互。
- 全局管道 / 拦截器 / 过滤器在 [`app.module.ts`](../be/src/app.module.ts) 用 `APP_PIPE` / `APP_INTERCEPTOR` / `APP_FILTER` 注册（不是 `main.ts` 的 `useGlobal*`），这样 e2e 测试里同样生效。

### 接口契约（不可绕过）

- 全局前缀 `/api`；Controller 只写去掉前缀的路径（`@Controller('map')`）。
- 返回值由 `TransformInterceptor` 统一包成 `{ code, data, message }`，**Controller 直接 `return` 业务对象**，不要自己拼这个壳。
- 异常由 `AllExceptionsFilter` 统一转为 `{ code, data, message, path, timestamp }`，并隐藏堆栈。业务错误抛 `BadRequestException` / `NotFoundException` 等 `HttpException` 即可。
- 全局 `ValidationPipe({ whitelist: true, transform: true })`：入参一律用 `class-validator` DTO，并在 DTO 上加 `@ApiProperty` 让 Swagger 有文档。
- 数据库主键用 `cuid()`；列表查询务必带 `where: { userId }` 隔离。
- **类型抽离**：controller / service 内不内联 `type` / `interface` / `enum`。入参出参做成
  `dto/*.dto.ts`（`class-validator` + `@ApiProperty`），枚举 / 常量放 `*.constants.ts`
  （参考 [`growth.constants.ts`](../be/src/growth/growth.constants.ts)），其余类型放 `*.types.ts`。
  前端不适用这条（前端保持「接口 + 常量标签与 `core/api/*.service.ts` 同文件」）。详见 `controller-service-types` skill。
- **分页**：列表接口统一 `data = { records, pagination: { page, pageSize, total } }`；
  `page` 传参从 `1` 开始（`skip = pageSize * (page - 1)`），不要用 `current` / `limit` / `perPage`。
- Swagger 描述**内联写在 controller 上**（`@ApiTags` / `@ApiOperation` / `@ApiParam`），**不拆 `*.controller.docs.ts`**；
  本项目单用户免登录，**没有** `@Roles` / `RolesGuard` 之类的 RBAC 装饰器，需要权限体系时先与用户确认。

### 单用户

MVP 免登录，[`CurrentUserService.ensureUserId()`](../be/src/common/current-user.service.ts) 固定返回 `local-user` 并做 upsert。**业务层不要自己写死用户 id**，一律调它——将来接登录只改这一处。

### 数据库（Prisma 7）

- [`be/prisma/schema.prisma`](../be/prisma/schema.prisma) 是数据模型的事实来源，对应规划第 7 节；连接串在 `be/prisma.config.ts` 里读 `be/.env` 的 `DATABASE_URL`（v7 起不写在 schema 里）。
- client 生成到 `be/src/generated/prisma`，**不要手改生成物**，从 `../generated/prisma/client.js` 导入类型。
- Prisma 7 必须用 driver adapter 建客户端（`PrismaPg`），见 `PrismaService`。
- 迁移：`npm run prisma:migrate`（dev，需要 shadow database，缺失时配 `SHADOW_DATABASE_URL`）；Neon 上迁移要用**直连地址**，不要用 `-pooler` 连接池地址。
- **任何迁移 / DB 变更前必须先征得用户同意**（`prisma:migrate`、`prisma:deploy`、`prisma:push` 都会改库）。`prisma:migrate` 会生成 migration 文件，要一并提交到 `be/prisma/migrations/`。
- `PrismaService` 连接失败**不让进程崩溃**，只记日志，由 `GET /api/health` 如实报 `database: "up" | "down"`。改这块时保持这个行为。

### AI（`be/src/ai/`）

- 调用点**只有四个**（规划第 8.1 节）：档案归类、生成任务线、评审打卡、周复盘。新需求先确认是否属于其中之一。
- 一律走 `AiService.completeJson()`：OpenAI 兼容 `/chat/completions` + 原生 JSON 模式 + **Zod 二次校验**。不要引 SDK，不要用自由文本 + 正则解析。
- 提示词集中在 [`src/ai/prompts/*.ts`](../be/src/ai/prompts/)，Zod 契约在 [`src/ai/schemas/*.ts`](../be/src/ai/schemas/)。归类规则是产品质量的全部来源，**改 prompt 时同步更新规划第 8 / 13.9 节里写死的规则**。
- 任何 AI 失败都抛 `AiUnavailableError`，由业务层**降级**（退回手动录入 / 默认模板），不要变成 500。参考 [`map-ingest.service.ts`](../be/src/growth/map-ingest.service.ts) 转成 503 + 提示文案的写法。
- provider 通过 `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY` 切换；**Key 只放后端环境变量，绝不进前端、绝不提交**。
- **隐私红线**：PDF 只在内存解析、不落盘；文本仅入库抽取结果；**日志不打印用户原文**（只记字数与条数，见 `map-ingest.service.ts`）。

---

## 前端约定（`fe/`）

### 组件

- **一律 standalone**，不写 `NgModule`；依赖注入用 `inject()`，不用构造函数参数。
- 状态用 **Signals**（`signal` / `computed` / `effect`），跨页面共享放 `core/state/`。
- 新组件加 `changeDetection: ChangeDetectionStrategy.OnPush`（Angular 22 默认 zoneless，无 zone.js）。
- 文件命名对齐现有风格：`features/map/map.ts` + `map.html` + `map.scss`，类名 PascalCase。

### HTTP（最容易踩的坑）

- 组件**不直接用 `HttpClient`**，走 `core/api/` 下的服务。
- 服务里写**相对路径且不带 `/api`**：`this.http.get<Goal[]>('/goals')`。`apiInterceptor` 会自动补 `environment.apiBaseUrl` 并解包 `{ code, data, message }`——业务代码直接拿 `data`（所以**不要**写 `/api/goals`，也不要硬编码 `localhost:3000`）。
- 响应类型与后端 DTO 一一对应，见 [`core/api/map.service.ts`](../fe/src/app/core/api/map.service.ts) 的写法（接口 + 常量标签放在同一个服务文件里）。

### 路由与页面

- [`app.routes.ts`](../fe/src/app/app.routes.ts) 全部懒加载，按 `features/` 组织，每个路由带 `title`。
- 未实现的页面复用 `shared/page-placeholder`（说明「计划在哪个里程碑做什么」），实现时只改路由里那一行 `loadComponent`，导航与标题不用动。
- 开发期 `/api` 由 `proxy.conf.json` 代理到 `http://localhost:3000`，所以跑前端时要同时起后端。
- `fe/package.json` **没有 `lint` 脚本**（Angular CLI 不再内置），提交前跑 `npm --prefix fe run build` 与 `npm --prefix fe run test`。

---

## 产品与范围纪律（重要）

- **MVP 冻结在 M7**，当前进度：M1 ✅ · M2 ✅ · M2.5 ✅ 个人档案录入 → **下一步 M3 目标与任务**。明细见规划第 9 节。
- 当前**已落地**的是成长地图的**录入与管理**（`/api/map/*`、`/map` 页面）。**看板属 M8、自动维护属 M9，不要顺手提前实现**（规划第 4 / 11 / 13.6 节反复强调）。
- MVP 明确不做（除非用户显式要求）：多用户 / 社交 / 排行榜、富文本编辑器 / 双向链接 / 标签体系 / 导入导出、移动 App / 推送、付费与社区、精致动画主题。**不要引入新的状态库或 UI 库**——Signals + Angular Material 够用。
- 硬规则（写死在各处 prompt 与文档里，别改）：**读完一本书 = 输入；能复述结论 = 知识；能用它解决真实问题并留下产出 = 技能**。任务线必须**输入与产出交替**。
- 需求看起来「顺便做一下」时，先按规划第 4 节判断是否越界；越界就明确告诉用户并给替代方案。

---

## 代码风格

- **注释、文档、提交信息用中文**，与现有代码保持一致。只给需要解释的地方写注释（模块职责、反直觉的取舍、为什么这么做），不要逐行复述代码。
- 关键约定尽量在文件顶部加一段块注释，并**引用规划章节号**（如「《项目规划》第 13.9 节」）——这是本仓库的统一风格。
- 后端格式化 `npm --prefix be run format`（Prettier），静态检查 `npm --prefix be run lint`（oxlint，type-aware）。
- 前端 Prettier 无脚本，需要时 `npx prettier --write`。

## 文档同步

改动以下内容时，**同一改动里**更新对应文档，不要留到之后：

| 改动 | 需要更新 |
| --- | --- |
| 接口（路径 / 请求体 / 响应） | `docs/项目规划/06-API设计.md`、必要时 `13-成长地图.md` 的 13.8 |
| 表结构 / 字段 | `docs/项目规划/07-数据模型.md`（与 `schema.prisma` 保持一致） |
| AI 调用点 / prompt 规则 / 模型 | `docs/项目规划/08-AI能力设计.md` |
| 里程碑完成情况 | `docs/项目规划.md` 的「当前进度」+ `docs/项目规划/09-里程碑路线图.md` + 根 `readme.md` 的「当前状态」 |
| 技术选型 / 版本 / 启动方式 | `fe/README.md` 或 `be/README.md` |
| AI 协作规范 / skills 本身 | 对应 `.github/skills/<name>/SKILL.md`，并在本文件的 skills 表里登记 |
| 大特性并行管理 | `docs/workstreams/ACTIVE_WORKSTREAM.md` + `active/<ID>/`（`IMPLEMENTATION_PLAN.md` / `WALKTHROUGH.md`） |
| bug 修复过程（用户要求时） | `docs/fixes/<简述>.md` |

## 交付要求

每次实现 / 修复完成后，按 `regression-checklist` skill 给出三样东西：**影响范围**、
**回归风险点（标注高/中/低）**、**测试自测清单（标注必须/建议）**。默认直接写在回复里；
有 workstream 或特性文档时写进对应文档（`WALKTHROUGH.md` / 特性小节）。
