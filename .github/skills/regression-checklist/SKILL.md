---
name: regression-checklist
description: 每次实现完成后必须提供回归影响分析、回归风险点和测试自测清单（含 InnerUp 必查项：后端 build/test/lint、前端 build/test、ESM 后缀、统一响应体、用户隔离、AI 降级、隐私红线）。内容写入 docs/workstreams/active/<ID>/WALKTHROUGH.md，或直接在回复中给出。
---

# 回归影响与测试清单

## 适用场景

- 每次实现/修复完成后（默认必须给出）

## 必须提供的内容

### 1. Impact Analysis（影响范围）

- 列出本次改动影响到的模块、文件、功能点
- 说明影响是正向（增强）还是潜在风险

### 2. Regression Risks（可能回归点）

- 列出可能因本次改动而产生回归的场景
- 标注高风险/中风险/低风险

### 3. Test Checklist（建议自测清单）

- 尽量具体，列出可执行的测试步骤
- 覆盖正常流程和边界情况
- 标注优先级（必须验证 / 建议验证）

## 写入位置

该内容应写入对应的交付文档：

- **Workstream 模式**：写入 `docs/workstreams/active/<ID>/WALKTHROUGH.md`
- **有对应特性/里程碑文档**：写入该文档（如 `docs/项目规划/09-里程碑路线图.md`）的相应小节
- **无文档模式**：直接在回复中提供（本项目默认走这条）

## 本项目必查项（InnerUp）

每次改动至少覆盖这些：

- **后端**：`npm --prefix be run build`、`npm --prefix be run test`（Vitest）、
  `npm --prefix be run lint`（oxlint）
- **前端**：`npm --prefix fe run build`、`npm --prefix fe run test`（Vitest）
- **接口契约**：返回体仍是 `{ code, data, message }`（成功 `code === 0`）；异常结构未被破坏
- **ESM**：新增相对导入都带 `.js` 后缀（漏了只在 `build` 时才炸）
- **用户隔离**：列表/详情查询带 `where: { userId }`，走 `CurrentUserService.ensureUserId()`
- **AI 链路**：AI 失败是否降级为 503 + 提示文案，而不是 500
- **隐私红线**：日志没有打印用户原文；PDF 没有落盘
- **文档同步**：按 `.github/copilot-instructions.md` 的「文档同步」表检查是否需要同改文档
- **数据模型**：改了 `schema.prisma` 时，`docs/项目规划/07-数据模型.md` 是否同步

## 示例

```
### Impact Analysis
- 修改了 UserService.create() 方法，影响用户注册流程
- 新增了 EmailValidator 工具类，影响所有调用邮箱校验的地方

### Regression Risks
- 【高风险】用户注册流程：create 方法签名变更，需验证所有调用方
- 【中风险】邮箱校验：新校验器可能拒绝之前合法的邮箱格式
- 【低风险】日志格式：新增了调试日志，不影响功能

### Test Checklist
- [必须] 验证用户注册正常流程（含邮箱、手机号）
- [必须] 验证重复邮箱注册被正确拦截
- [建议] 验证特殊格式邮箱（如 plus addressing）的校验行为
- [建议] 验证并发注册场景下的唯一性约束
```
