---
name: shell-tools-standard
description: 从 Shell 调用工具时的标准规范。查找文本用 rg（ripgrep），查找代码结构用 ast-grep（TS/TSX），匹配项选择用 fzf，JSON 用 jq，YAML/XML 用 yq。有 ast-grep 时优先使用，避免 rg/grep 做代码结构搜索。（本机实测：仅 rg 可用，ast-grep/jq/yq/fzf 均未安装，按文中退化方案处理）
---

# Shell 工具调用标准

## 适用场景

- 需要在 Shell 中查找文本、代码结构、JSON、YAML/XML 时
- 需要在匹配项中进行交互式选择时

## 工具选择标准

| 场景 | 工具 | 示例 |
|------|------|------|
| 查找文本 | `rg`（ripgrep） | `rg "pattern" src/` |
| 查找代码结构（TS） | `ast-grep --lang ts` | `ast-grep --lang ts -p '<pattern>'` |
| 查找代码结构（TSX） | `ast-grep --lang tsx` | `ast-grep --lang tsx -p '<pattern>'` |
| 查找代码结构（其他语言） | `ast-grep --lang <lang>` | `ast-grep --lang rust -p '<pattern>'` |
| 匹配项交互选择 | `fzf` | `rg "pattern" \| fzf` |
| JSON 处理 | `jq` | `cat data.json \| jq '.key'` |
| YAML/XML 处理 | `yq` | `cat config.yaml \| yq '.key'` |

## 本项目环境（Windows + PowerShell）

**先看这里再选工具**，下表是开发机实测情况：

| 工具 | 状态 | 说明 |
| --- | --- | --- |
| `rg` | ✅ 可用 | 直接调 `rg` 即可；也可用内置的 `grep` 工具 |
| `ast-grep` / `sg` | ❌ 未安装 | 本项目为 TS/TSX，需要结构化搜索时退化为 `rg` + 读代码，或先与用户确认是否安装 |
| `jq` | ❌ 未安装 | JSON 处理改用 `node -e "..."` |
| `yq` | ❌ 未安装 | YAML/XML 处理改用 `node` 或 `Get-Content` |
| `fzf` | ❌ 未安装 | 匹配项选择退化为「列出候选 + 让用户选」 |

- 因此**本仓库默认用 `rg`**；上面表格里的 `ast-grep` / `jq` / `yq` / `fzf` 属于
  「若环境已具备则优先使用」，没有就按右列退化方案处理
- 不要用 DOS 命令（`dir` / `type` / `findstr`），一律用 PowerShell 原生命令
  （`Get-ChildItem` / `Get-Content` / `Select-String`）
- 路径一律用 Windows 反斜杠形式，如 `d:\www\innerup\be\src`
- 能直接用内置的 `grep` / `glob` / `view` 工具时，优先用工具而不是拼 shell 命令

## 核心原则

- **如果可用 ast-grep，请避免使用 `rg` 或 `grep` 做代码结构搜索**，除非明确要求进行纯文本搜索
- ast-grep 能理解语法结构（如函数声明、类定义、装饰器等），比纯文本搜索更精确
- 对于纯文本搜索（如查找字符串字面量、注释内容），使用 `rg`
