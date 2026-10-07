---
name: ai-wiki
description: 项目知识库管理规范（InnerUp 适配版）。本项目的知识库就是 docs/项目规划/（索引 + 分节正文）+ be/README.md / fe/README.md + .github/copilot-instructions.md，不另建 ai-wiki/ 目录。开发前先读相关章节，开发中遇到规则性信息及时写回对应文档并保持索引同步；大特性可用 docs/workstreams/ 并行管理。
---

# 项目知识库管理（InnerUp）

## 适用场景

- 新进入本项目，需要了解结构、约束、配置
- 开发中遇到「规则性信息 / 第三方 API 文档地址 / 重要约束 / 配置项」
- 需要管理多个并行特性的开发进度
- 需要记录 feature 总结或 bug 修复过程（**仅在用户明确要求时**）

## 本项目知识库 = `docs/项目规划/`

> ⚠️ **不要新建 `ai-wiki/` 目录。**
> 本仓库已经有一套知识库，唯一事实来源是 `docs/项目规划.md`（索引页）
> 加 `docs/项目规划/01…13`（分节正文），再叠加 `.github/copilot-instructions.md`
> 里的仓库级硬约束。

| 想了解 | 去哪看 |
| --- | --- |
| 一句话定位 / 核心理念 | `docs/项目规划/01-一句话定位.md`、`02-核心理念.md` |
| 产品模块 / MVP 范围 | `03-产品模块.md`、`04-MVP范围.md` |
| 技术方案 / 需要规避的风险 | `05-技术方案.md`、`11-风险与对策.md` |
| 接口设计 | `06-API设计.md` |
| 数据模型（必须与 `be/prisma/schema.prisma` 一致） | `07-数据模型.md` |
| AI 调用点 / prompt 规则 | `08-AI能力设计.md` |
| 里程碑与当前进度 | `09-里程碑路线图.md` + `docs/项目规划.md` 顶部「当前进度」 |
| 目录结构 | `10-目录结构.md` |
| 成长地图细节（五类对象、归类规则） | `13-成长地图.md` |
| 前端启动方式 / 脚本 / 前端约定 | `fe/README.md` |
| 后端启动方式 / 脚本 / 后端约定 | `be/README.md` |
| 仓库级硬约束（ESM `.js` 后缀、统一响应体、隐私红线…） | `.github/copilot-instructions.md` |

## 开发前检查

- 先读 `docs/项目规划.md` 索引，**再按需只读相关那一节**，不要通读全文
- 把知识库当强参考，但保持警惕：它可能滞后。以当前代码与 `be/prisma/schema.prisma` 为准，发现不一致时顺手纠正文档

## 开发中维护

- 遇到「规则性信息 / 第三方 API 文档地址 / 重要约束 / 配置项」，必须及时写回上表对应的文档
- 写回后检查 `docs/项目规划.md` 的索引与章节标题仍然对得上
- 不要另起一套平行文档体系（不要建 `ai-wiki/`、不要建重复的 `docs/xx.md` 与 `docs/项目规划/xx.md`）
- 具体「哪个改动要同步哪份文档」见 `.github/copilot-instructions.md` 末尾的「文档同步」表

## Feature / Fix 记录规则

- `docs/features/`：**仅当用户明确要求**「记录本次 feature 总结」才写入
- `docs/fixes/`：**仅当用户明确要求**「记录该 bug 起因与处理方式」才写入
- 不要主动写入 feature / fix 记录
- 非平凡 bug 的文档要求见 `coding-conventions` skill（Bug 介绍 / 原因 / 修复方式 / 修复思路）

## Workstream（多特性并行管理）

> 本项目默认用「M1/M2 分阶段 + `docs/项目规划/09-里程碑路线图.md`」管理进度。
> **只有当用户明确要求、或特性确实大到需要独立文档时**，才启用 workstream。

```
docs/workstreams/
├── ACTIVE_WORKSTREAM.md          # 指向当前工作流
├── active/
│   └── <ID>/
│       ├── IMPLEMENTATION_PLAN.md
│       └── WALKTHROUGH.md        # 完成后补写（含回归清单）
└── archive/
    └── <YEAR>/
        └── <ID>/
```

1. 创建 `docs/workstreams/active/<ID>/IMPLEMENTATION_PLAN.md`
2. 在 `docs/workstreams/ACTIVE_WORKSTREAM.md` 里指向当前工作流
3. 完成后补 `WALKTHROUGH.md`（回归影响与测试清单写在这里，见 `regression-checklist` skill）
4. 归档到 `docs/workstreams/archive/<YEAR>/<ID>/`

### 实施进度管理

- 每个阶段的细分使用 **M1、M2** 等命名
- 参考开发文档推进时，及时回写开发进度与方案变更
- 每次更新进度时，在 M1、M2… 后方写上（开发中）、（已完成）等状态
- 通过文档保证多个 session 之间的信息互通
