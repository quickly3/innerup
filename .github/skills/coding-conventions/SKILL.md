---
name: coding-conventions
description: 编码约定与特殊约定规范。禁止无意义封装，代码要简洁易懂、注意圈复杂度、最小化修改。特定需求开发用 M1/M2 命名分阶段管理进度。修 bug 时需生成 bug 介绍文档。全新项目 UI 优先考虑 Mantine（⚠️ 本项目已定 Angular + Angular Material，不再引入新 UI 库）。
---

# 编码约定与特殊约定

## 适用场景

- 编写或修改代码时
- 进行特定需求开发与分阶段管理时
- 修复 bug 时
- 全新项目 UI 选型时

## 代码风格原则

- 不要过度设计，保证代码简洁易懂，简单实用
- 写代码时要注意圈复杂度（cyclomatic complexity），代码尽可能复用
- 改动时最小化修改，尽量不修改到其他模块代码

## 禁止无意义封装

不要把没有复用价值、没有隐藏复杂性、没有表达稳定领域语义的一两行代码抽成方法。

- **尤其禁止**：只做空值兜底、字段转发、简单 getter 包装
- **只有当满足以下条件之一时才封装方法**：
  - 该逻辑会被复用
  - 命名能显著解释业务意图
  - 能隔离复杂或易错的约束
- 否则新增私有小方法只会割裂阅读上下文，应主动内联收敛

## 特定需求开发分阶段管理

- 每个阶段的细分使用 **M1、M2** 等命名
- 当参考开发文档进行开发时，需要及时更新开发进度与方案
- 通过文档来保证多个 session 之间的信息互通
- 每次更新进度时，在 M1、M2... 等后方写上（开发中）、（已完成）等状态

## Bug 修复文档要求

当修复一个 bug 时，如果 bug **不是**一个简单的变量未定义之类的问题，则应该额外生成一份文档，包含：

- Bug 介绍
- 产生的原因
- 当前修复的方式
- 修复的思路

## 全新项目 UI 选型

- 对于**全新**项目做 UI 选型时，可优先考虑 **Mantine**
- ⚠️ **本项目（InnerUp）已经定过选型，不适用上面的建议**，见下节

## 本项目适配（InnerUp）

- **UI / 状态库已冻结**：前端是 Angular 22 + Angular Material（standalone + Signals，zoneless）。
  不要再引入 Mantine，也不要引入任何新的 UI 库、组件库或状态库（见
  `.github/copilot-instructions.md` 的「产品与范围纪律」）
- **分层**：后端逻辑放 service，controller 只做路由与参数接收（见 `create-api` skill）
- **类型抽离**：controller / service 内不内联业务类型（见 `controller-service-types` skill）
- **分页**：统一返回 `page / pageSize / total`（见 `pagination-format` skill）
- **M 阶段命名**：与 `docs/项目规划/09-里程碑路线图.md` 的 M1…M7 保持一致，
  每次进度变化同步 `docs/项目规划.md` 的「当前进度」和对应分节
- **Bug 文档**：非平凡 bug 写 `docs/fixes/<简述>.md`（**先征得用户同意**），
  内容含 Bug 介绍 / 产生原因 / 当前修复方式 / 修复思路
- **回归清单**：每次实现完成后按 `regression-checklist` skill 给出影响分析与自测清单
