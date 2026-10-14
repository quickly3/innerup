# 6. API 设计（REST）

> 本文档为《项目规划》第 6 节 · [← 返回索引](../项目规划.md)

统一前缀 `/api`，前端通过 Angular `HttpClient` 调用；后端由 NestJS Controller 暴露，Swagger 自动生成文档。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/profile` | 角色卡：等级、XP、技能、streak（**个人档案**在 `/api/map/*`，见下） |
| `GET` | `/api/goals` | 目标（任务线）列表，带回每个目标的任务进度（`questCounts`；支持 `?status=`，`page` / `pageSize` 简单分页）（M3 ✅） |
| `POST` | `/api/goals` | 创建目标（M3 ✅） |
| `GET` | `/api/goals/:id` | 目标详情（含任务，按 `order` 排序）（M3 ✅） |
| `PATCH` | `/api/goals/:id` | 更新目标（标题 / 说明 / 状态）（M3 ✅） |
| `DELETE` | `/api/goals/:id` | 删除目标（级联删除任务与打卡）（M3 ✅） |
| `POST` | `/api/goals/:id/generate` | **AI 生成任务线**（核心接口，M4 ✅）：请求体 `{ currentLevel?, weeklyHours?, mode? }`，返回**已落库**的任务 |
| `GET` | `/api/quests` | 任务列表（支持 `?goalId=` / `?status=` / `?kind=` / `?date=today`）（M3 ✅） |
| `POST` | `/api/quests` | 手动创建任务（M3 ✅） |
| `PATCH` | `/api/quests/:id` | 更新任务（状态 / 排序 / 类型 / 难度 / XP / 预计时长 / 截止时间）（M3 ✅） |
| `DELETE` | `/api/quests/:id` | 删除任务（级联删除打卡记录）（M3 ✅） |
| `POST` | `/api/quests/:id/checkin` | **打卡**，返回获得的 XP 与 AI 反馈（M5） |
| `GET` | `/api/insights/weekly` | **AI 周报**（SSE 流式可选） |
| `POST` | `/api/discovery/chat` | 兴趣发掘对话（后续迭代） |
| `GET` | `/api/map` | **个人档案**快照：五类对象 + 关联关系（M2.5 ✅） |
| `POST` | `/api/map/ingest` | **文本录入 → AI 归类**，返回待确认候选（M2.5 ✅） |
| `POST` | `/api/map/ingest/pdf` | **上传 PDF（multipart）→ 抽文本 → AI 归类**（M2.5 ✅） |
| `POST` | `/api/map/ingest/github` | **GitHub 地址 → 读账号资料卡 + 公开仓库 README → AI 归类**（M2.5 ✅） |
| `POST` | `/api/map/candidates/apply` | 确认候选（可编辑 / 部分确认）落库（M2.5 ✅） |
| `POST` | `/api/map/focus` | 手动新增关注点（M2.5 ✅；`interest` / `input` / `knowledge` / `skill` 同理） |
| `PATCH` | `/api/map/:kind/:id` | 更新状态 / 进度（`kind`: focus / interest / input / knowledge / skill，M2.5 ✅） |
| `DELETE` | `/api/map/:kind/:id` | 删除条目（M2.5 ✅） |
| `GET` | `/api/map/board` | 看板数据：每类「多久没动」+ 消化率（M8） |
| `GET` | `/api/map/suggestions` | AI 从近期打卡抽取的待确认更新建议（M9） |
| `POST` | `/api/map/suggestions/apply` | 一键确认落库（M9） |

> **命名区分（重要）**：`/api/profile` 是**角色卡**（等级 / XP / 技能雷达 / streak）；**个人档案**（成长地图五类对象）走 `/api/map/*`。前者 M5 实现，后者的**录入部分 M2.5 已落地**、看板 M8、自动维护 M9（见[第 13.8 节](./13-成长地图.md)）。

**约定：**

- 统一响应体：`{ code, data, message }`
- 全局 `ValidationPipe`（`whitelist: true`）校验 DTO；全局异常过滤器统一错误格式
- AI 接口耗时较长：生成任务线走**普通请求**（同步等结果，可能要十几秒，前端期间禁用按钮）；评审 / 复盘用 **SSE**（NestJS `@Sse()` 装饰器）流式返回
- 文件上传（PDF）走 `multipart/form-data`，用 NestJS `FileInterceptor`（Multer 内存存储），限制类型与大小（≤10MB）；解析出的文本仅用于本次 AI 归类，默认不落盘（见[第 13.9 节](./13-成长地图.md)）
- GitHub 录入（`/api/map/ingest/github`）由后端解析用户填的地址后**只访问 `https://api.github.com`**（防 SSRF），只读账号公开资料卡（overview）与公开仓库、不落盘；限额与可选 `GITHUB_TOKEN` 见[第 13.10 节](./13-成长地图.md)
- 前端用 `HttpInterceptorFn` 统一处理 baseURL（开发期配合 `proxy.conf.json` 代理）与响应解包；**错误文案**统一走 `core/api/http-error.ts` 的 `describeHttpError()`，**loading** 由各页面自己的 Signal 管理（请求粒度不同，放进拦截器反而不好用）

**列表接口的分页口径（M3 起）：**

| 接口 | 返回形态 | 说明 |
| --- | --- | --- |
| `GET /api/quests` | `data = { records, pagination: { page, pageSize, total } }` | 标准分页体（首个落点） |
| `GET /api/goals` | `data = Goal[]`（数组） | 任务线条数是「个位数量级」，只做 `page` / `pageSize` 简单分页 |

- `page` 传参**从 `1` 开始**（`skip = pageSize * (page - 1)`），不要用 `current` / `limit` / `perPage`
- 用户隔离：所有查询都按 `CurrentUserService.ensureUserId()` 过滤，任务通过 `goal.userId` 判断归属

**`?date=today` 的定义（M3）：** `Quest` 表没有 `updatedAt`（见[第 7 节](./07-数据模型.md)），所以「今日」= **今天到期的 + 正在做的（`doing`）+ 逾期未完成的**。「今天完成了什么」要等 M5 的打卡记录（`CheckIn.createdAt`）才准。

**`POST /api/goals/:id/generate`（M4）的口径：**

- 请求体：`{ currentLevel?: string(≤500), weeklyHours?: 1~40, mode?: 'append' | 'replace' }`，都可省略。
- 生成依据 = 目标标题 / 说明 + `currentLevel` + `weeklyHours` + **档案快照**（五类对象，带状态 / 进度 / 等级，见[第 13.2 节](./13-成长地图.md)）。
- **同步请求 + 直接落库**（不是候选确认）：AI 生成 3~7 条任务（《项目规划》第 4 节的口径），一次事务写入。
- **AI 不可用不报错**：改用代码里的通用模板兜底（第 8.2 节「结果缓存 / 降级」），响应里 `source: "template"` 明确标注「非 AI 生成」，前端据此提示用户（`ai` = 模型生成）。
- `mode=append`（默认）追加到任务线末尾；`mode=replace` 先删掉该目标下**还没开始（`todo`）**的任务再写入——在做 / 已完成的任务与打卡记录保留。
- 返回 `data = { goalId, suggestedTitle, created: Quest[], replaced: number, source: 'ai' | 'template', meta: { mapItems, weeklyHours } }`：`created` 是**本次落库的任务**，`suggestedTitle` 是 AI 建议的更可验收的标题（**不直接改库**，由用户在前端点「采纳」）；`meta.mapItems = 0` 表示档案还是空的（只能按通用路径生成）。
- 任务的**验收标准（`acceptance`）不单独建列**，落库时并进 `Quest.description`（见[第 7 节](./07-数据模型.md)）。
