# InnerUp

这是一个用于自我提升的项目，包括前端和后端。
以 AI 辅助，以游戏任务的形式，发掘制定任务、练习技能、发掘兴趣爱好。

## 核心闭环

```
发掘兴趣 → 制定任务线 → 执行打卡 → AI 反馈 → 获得 XP 升级 → 回到制定
```

## 文档

- [项目规划（产品 / 技术 / 数据模型 / 路线图）](./docs/项目规划.md) —— 索引页；正文按章节拆分在 [`docs/项目规划/`](./docs/项目规划/) 下，按需单节阅读
- [前端说明（fe/ · Angular）](./fe/README.md)
- [后端说明（be/ · NestJS 11）](./be/README.md)

## 技术栈

- **前端（`fe/`）**：Angular 22（standalone + Signals，zoneless）+ Angular Router + Angular Material + ngx-echarts
- **后端（`be/`）**：NestJS 12 + Prisma 7 + PostgreSQL
- **AI**：云端大模型 API（仅后端调用，结构化输出 + SSE 流式）
- **架构**：前后端分离，通过 REST API 通信（见规划文档第 6 节）

## 当前状态

- ✅ **M1 脚手架**：Angular + NestJS + Prisma + 远端 PostgreSQL 跑通（`/api/health` 通、数据库连通）
- ✅ **M2 数据与骨架**：首次迁移落库（`be/prisma/migrations`）、前端路由骨架与基础布局、Swagger 可访问
- ⏭️ **下一步 M3 目标与任务**：Goal / Quest 的 REST CRUD + 前端页面

进度与验收标准见[规划文档第 9 节 · 里程碑路线图](./docs/项目规划/09-里程碑路线图.md)。