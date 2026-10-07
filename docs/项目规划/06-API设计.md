# 6. API 设计（REST）

> 本文档为《项目规划》第 6 节 · [← 返回索引](../项目规划.md)

统一前缀 `/api`，前端通过 Angular `HttpClient` 调用；后端由 NestJS Controller 暴露，Swagger 自动生成文档。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/profile` | 角色卡：等级、XP、技能、streak（**个人档案**在 `/api/map/*`，见下） |
| `GET` | `/api/goals` | 目标（任务线）列表 |
| `POST` | `/api/goals` | 创建目标 |
| `GET` | `/api/goals/:id` | 目标详情（含任务） |
| `PATCH` | `/api/goals/:id` | 更新目标（标题 / 状态） |
| `DELETE` | `/api/goals/:id` | 删除目标 |
| `POST` | `/api/goals/:id/generate` | **AI 生成任务线**（核心接口） |
| `GET` | `/api/quests` | 任务列表（支持 `?date=today`） |
| `POST` | `/api/quests` | 手动创建任务 |
| `PATCH` | `/api/quests/:id` | 更新任务（状态 / 排序） |
| `POST` | `/api/quests/:id/checkin` | **打卡**，返回获得的 XP 与 AI 反馈 |
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
- AI 接口耗时较长：生成任务线走普通请求；评审 / 复盘用 **SSE**（NestJS `@Sse()` 装饰器）流式返回
- 文件上传（PDF）走 `multipart/form-data`，用 NestJS `FileInterceptor`（Multer 内存存储），限制类型与大小（≤10MB）；解析出的文本仅用于本次 AI 归类，默认不落盘（见[第 13.9 节](./13-成长地图.md)）
- GitHub 录入（`/api/map/ingest/github`）由后端解析用户填的地址后**只访问 `https://api.github.com`**（防 SSRF），只读账号公开资料卡（overview）与公开仓库、不落盘；限额与可选 `GITHUB_TOKEN` 见[第 13.10 节](./13-成长地图.md)
- 前端用 `HttpInterceptorFn` 统一处理 baseURL（开发期配合 `proxy.conf.json` 代理）、错误提示与 loading 状态
