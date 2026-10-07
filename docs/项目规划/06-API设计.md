# 6. API 设计（REST）

> 本文档为《项目规划》第 6 节 · [← 返回索引](../项目规划.md)

统一前缀 `/api`，前端通过 Angular `HttpClient` 调用；后端由 NestJS Controller 暴露，Swagger 自动生成文档。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/profile` | 角色面板：等级、XP、技能、streak |
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

**约定：**

- 统一响应体：`{ code, data, message }`
- 全局 `ValidationPipe`（`whitelist: true`）校验 DTO；全局异常过滤器统一错误格式
- AI 接口耗时较长：生成任务线走普通请求；评审 / 复盘用 **SSE**（NestJS `@Sse()` 装饰器）流式返回
- 前端用 `HttpInterceptorFn` 统一处理 baseURL（开发期配合 `proxy.conf.json` 代理）、错误提示与 loading 状态
