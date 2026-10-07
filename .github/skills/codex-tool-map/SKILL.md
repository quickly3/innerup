---
name: codex-tool-map
description: Compound Codex 工具映射（Claude 兼容性）。将 Claude Code 插件工具引用映射到 Codex 行为，包括 Read/Write/Edit/Bash/Grep/Glob/LS/WebFetch/AskUserQuestion/Task/TodoWrite/Skill 等工具的对应替代方案。此 skill 块由系统自动管理。
---

# Compound Codex Tool Mapping (Claude Compatibility)

## 适用场景

- 当需要将 Claude Code 插件工具引用映射到 Codex 行为时
- 此 skill 块由系统自动管理，不应手动编辑

## 本项目适配（InnerUp）⚠️

本仓库运行在 **VS Code + GitHub Copilot** 环境，**不是 Codex**。下表只是
「Claude Code 插件工具名 → 替代方案」的对照表，**仅在读到某个 Claude Code 插件/SKILL
里引用了 `Read` / `Write` / `Edit` / `Bash` / `TodoWrite` 这类工具名时**，用它来理解意图。

在本仓库中请**优先使用 Copilot 原生工具**，不要按本表切换到 Codex 专用原语：

| 需求 | 本仓库用什么 |
| --- | --- |
| 读文件 | `view`（大文件用 `view_range`） |
| 写/改文件 | `create`（新文件）/ `edit`（改已有文件） |
| 执行命令 | `powershell` |
| 搜索 | `grep` / `glob` 工具，或 shell 里的 `rg` |
| 询问用户 | `ask_user`（**不要**用编号列表等用户回复数字） |
| 任务跟踪 | `sql`（`todos` / `todo_deps` 表） |
| 并行调研 | `search_code_subagent` / `task` |

## 工具映射表

| Claude Code 工具 | Codex 替代方案 |
|-----------------|---------------|
| Read | 使用 shell 读取（cat/sed）或 rg |
| Write | 通过 shell 重定向创建文件或使用 apply_patch |
| Edit / MultiEdit | 使用 apply_patch |
| Bash | 使用 shell_command |
| Grep | 使用 rg（fallback: grep） |
| Glob | 使用 `rg --files` 或 `find` |
| LS | 通过 shell_command 使用 `ls` |
| WebFetch / WebSearch | 使用 curl 或 Context7 获取库文档 |
| AskUserQuestion / Question | 以编号列表形式在聊天中呈现选项并等待回复编号；多选接受逗号分隔编号；**永远不要跳过或自动配置--始终等待用户响应后再继续** |
| Task (subagent) / Subagent / Parallel | 在主线程中顺序运行；使用 multi_tool_use.parallel 进行工具调用 |
| TaskCreate / TaskUpdate / TaskList / TaskGet / TaskStop / TaskOutput | 使用 update_plan（Codex 的任务跟踪原语） |
| TodoWrite / TodoRead（legacy） | 使用 update_plan（已弃用） |
| Skill | 打开引用的 SKILL.md 并遵循其指引 |
| ExitPlanMode | 忽略 |

## 注意事项

- 只有 `<!-- BEGIN COMPOUND CODEX TOOL MAP -->` 和 `<!-- END COMPOUND CODEX TOOL MAP -->` 之间的内容由系统自动管理
- 不要手动编辑此映射表，除非明确知道在做什么
