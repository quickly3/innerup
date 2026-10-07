---
name: context7-docs
description: 凡涉及库/API/配置步骤，一律优先使用 Context7（MCP）检索权威文档，不要凭记忆硬写。适用于代码生成（特别是第三方库调用）、设置/配置/部署步骤、任何库/API 文档/SDK 用法等场景。
---

# Context7 文档优先检索

## 适用场景

- 任务涉及代码生成，特别是第三方库调用
- 需要设置/配置/部署步骤
- 需要查阅任何库 / API 文档、SDK 用法

## 执行原则

1. **必须优先使用 Context7（MCP）检索权威资料**
   - 自动解析库 ID 并获取文档
   - 不要凭记忆硬写

2. **若 Context7 无法获取资料，按以下优先级降级：**
   - 次选：repo 内文档 —— `docs/项目规划/01…13`、`be/README.md`、`fe/README.md`、
     `.github/copilot-instructions.md`（本项目**没有** `ai-wiki/` 目录）
   - 再次选：读源码 / 示例，本项目自带实例可直接参考：`be/src/growth/`、`fe/src/app/core/api/`
   - 最后：明确标注不确定性并给出可验证方式

## 注意事项

- 即使 Context7 返回了文档，也要结合当前项目上下文判断适用性
- 本项目依赖版本较新（Angular 22、NestJS 12、Prisma 7、Vitest 4/5、Angular Material 22），
  网上文档容易过时，**以 `be/package.json` / `fe/package.json` 里的实际版本为准**
- 对于项目内部封装的 API（如 `AiService.completeJson()`、`TransformInterceptor`、
  `apiInterceptor`），Context7 不会有文档，应直接读源码
