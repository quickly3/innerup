# InnerUp

这是一个用于自我提升的项目，包括前端和后端。
以 AI 辅助，以游戏任务的形式，发掘制定任务、练习技能、发掘兴趣爱好。

## 核心闭环

```
发掘兴趣 → 制定任务线 → 执行打卡 → AI 反馈 → 获得 XP 升级 → 回到制定
```

## 文档

- [项目规划（产品 / 技术 / 数据模型 / 路线图）](./docs/项目规划.md)
- [前端说明（fe/ · Angular）](./fe/README.md)
- [后端说明（be/ · NestJS 11）](./be/README.md)

## 技术栈

- **前端（`fe/`）**：Angular 20+（standalone + Signals）+ Angular Router + Angular Material + ngx-echarts
- **后端（`be/`）**：NestJS 11 + Prisma + PostgreSQL
- **AI**：云端大模型 API（仅后端调用，结构化输出 + SSE 流式）
- **架构**：前后端分离，通过 REST API 通信（见规划文档第 6 节）

## 当前状态

规划阶段（MVP 范围已定义，见规划文档第 4 节）。