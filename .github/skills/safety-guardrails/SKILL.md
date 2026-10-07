---
name: safety-guardrails
description: 安全防护栏规范（InnerUp 版）。不擅自改动 infra/secrets/CI，安装依赖先给方案再征求同意，禁止提交 .env/密钥/令牌，用户输入必须校验与编码，任何数据库变更必须先征得用户同意，git push/删除文件/完整构建等操作需用户确认。
---

# 安全防护栏（InnerUp）

## 适用场景

- 涉及基础设施、密钥、CI / 构建配置的修改
- 需要安装依赖
- 涉及用户输入处理
- 涉及数据库变更
- 涉及 Git 操作、文件删除、完整构建执行

## 通用安全原则

- **不在无确认的情况下改动 infra / secrets / CI**
- **如需安装依赖，先给出方案与影响，再征求同意**
- 开发时避免使用系统钥匙串等方案存储数据

## 密钥与敏感信息（本项目实际项）

- 🚫 不提交 `be/.env`（已在 `.gitignore` 中），需要的模板写在 `be/.env.example`
- 🚫 不提交任何密钥/令牌，敏感配置一律走环境变量：

  | 变量 | 用途 | 位置 |
  | --- | --- | --- |
  | `DATABASE_URL` | PostgreSQL 连接串 | `be/.env` |
  | `SHADOW_DATABASE_URL` | 迁移用 shadow database（可选） | `be/.env` |
  | `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | AI provider | `be/.env` |

- **`AI_API_KEY` 只放后端**，绝不进前端、绝不提交、绝不出现在日志与响应里
- 处理用户输入一律做校验与编码（DTO + `class-validator`）

## 生成物与保护目录

- 请勿手改 `be/src/generated/prisma/**`（Prisma 生成物，已在 `.gitignore` 中）
- 构建产物不要进入提交：`be/dist/**`、`fe/dist/**`（已在 `.gitignore` 中）
- ⚠️ `be/tsconfig.build.tsbuildinfo` 是构建产物，但目前**被 Git 跟踪**（`.gitignore` 未覆盖），
  改代码后它几乎必然变动：不要把它写进本次改动说明，也不要顺手 `git rm --cached`
  ——是否从版本库移除属于单独的仓库卫生问题，需先与用户确认
- 不要把用户上传的原始文件落盘（隐私红线：PDF 只在内存解析）

## 数据库变更限制（重要）

- **任何数据库变更都必须先向用户说明并取得同意**，包括
  `npm --prefix be run prisma:migrate` / `prisma:deploy` / `prisma:push`
- 不要擅自执行迁移；用户同意后再跑，并确认生成的 SQL 对已有数据安全
- 详细流程见 `prisma-change` skill

## 需要用户确认的操作

以下操作在执行前**必须经过用户同意**：

- package installs（安装/升级依赖）
- git push 及其他会改动远端历史的 Git 操作（提交 commit 按用户要求执行）
- deleting files（删除文件）
- chmod（修改文件权限）
- running full build or end-to-end suites（运行完整构建或端到端测试）
- 任何数据库变更 / migration
- 改动 CI、部署脚本、`.env` 模板中的密钥相关部分

## 遇到不确定时

- 停下来提问（用 `ask_user`），给出方案与影响，而不是先改
- 如果任务与上述护栏冲突，明确告诉用户冲突点，再给替代方案
