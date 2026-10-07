---
name: controller-service-types
description: "新建或修改 NestJS controller/service 文件时参考：type、interface、enum、const union 等类型定义必须抽离到单独文件，避免写在 controller/service 内"
---

# Controller / Service 类型抽离规范

## 适用场景

- 新建或修改 `*.controller.ts` 文件
- 新建或修改 `*.service.ts` 文件
- 在 controller/service 中新增或调整 `type`、`interface`、`enum`、字面量联合类型、DTO-like 入参/出参类型
- 从现有 controller/service 中整理内联类型定义

## 核心要求

- controller/service 文件中不要直接声明业务类型：`type`、`interface`、`enum`、可复用常量类型等都要放到单独文件。
- controller 只负责路由、参数接收、权限/用户上下文获取、调用 service。
- service 只负责业务逻辑实现；允许使用类型，但类型声明应从独立文件导入。
- 新增类型文件应与所属模块放在同一目录，优先使用清晰后缀：
  - `xxx.types.ts`：普通类型、Query、Body、Options、Result 等
  - `xxx.enums.ts`：枚举或枚举风格常量较多时
  - `xxx.constants.ts`：运行时常量、字面量数组、映射表
  - `xxx.dto.ts`：已有模块明确使用 DTO/class-validator/class-transformer 风格时
- 如果类型只服务于单个 controller/service，也仍然抽离到同目录独立文件，不要因为“只用一次”写在 controller/service 顶部。

## 本项目适配（InnerUp）——优先级高于下文通用约定

本节覆盖下面的文件名与命名建议，实际以本仓库现状为准：

| 类型 | 放哪 | 命名 |
| --- | --- | --- |
| 请求体 / 查询参数 / 出参（走 `class-validator` 校验） | 模块下的 `dto/` 子目录，`*.dto.ts` | `CreateXxxDto`、`UpdateXxxDto`、`XxxQueryDto`、`XxxResultDto` |
| service 内部入参 / 返回值等非校验类型 | 与模块同目录的 `*.types.ts` | `XxxOptions`、`XxxParams`、`XxxResult` |
| 枚举、字面量联合、常量数组、映射表 | 与模块同目录的 `*.constants.ts` | `XxxKind`、`XXX_STATUSES`（参考 `be/src/growth/growth.constants.ts`） |

本项目实例：`be/src/growth/dto/create-item.dto.ts`、`be/src/growth/growth.constants.ts`。

补充规则：

- **`dto/` 优先于 `*.types.ts`**：只要类型会作为接口入参/出参被 `ValidationPipe` 处理，一律做成
  `*.dto.ts` class，并加 `@ApiProperty`（这样 Swagger 才有文档）
- **ESM 后缀**：本项目是 ESM，类型文件被引用时同样要带 `.js` 后缀，
  如 `import type { CreateFocusDto } from './dto/create-item.dto.js'`
- **Prisma 生成类型**从 `../generated/prisma/client.js` 导入，不要复制定义，也不要手改生成物
- **前端（`fe/`）不适用本节**：前端现有风格是「接口类型 + 常量标签与对应
  `core/api/*.service.ts` 同文件」，例如 `fe/src/app/core/api/map.service.ts`，
  不要把后端的拆分规则强加到前端服务文件上

## 命名建议

- controller 请求体：`CreateXxxBody`、`UpdateXxxBody`、`DeleteXxxBody`
- controller 查询参数：`ListXxxQuery`、`XxxListQuery`
- service 入参：`CreateXxxOptions`、`UpdateXxxOptions`、`ListXxxParams`
- service 返回：`XxxResult`、`XxxListResult`
- 状态/类型枚举：`XxxStatus`、`XxxType`、`XxxOperation`
- 避免过于泛化的名称，如 `Query`、`Body`、`Result`、`Config`。

## 文件放置规则

1. 单模块私有类型
   - 放在当前模块目录下。
   - 示例（本项目）：`be/src/growth/growth.types.ts`（DTO 则放 `be/src/growth/dto/create-item.dto.ts`）
2. 枚举或运行时常量
   - 若已有 `*.constants.ts`，优先复用；否则按职责新增 `*.enums.ts` 或 `*.constants.ts`。
   - 示例（本项目）：`be/src/growth/growth.constants.ts`
3. 跨模块复用类型
   - 放到更高层共享目录前，先确认是否真的跨模块复用。
   - 不要为了未来可能复用而提前放到全局目录。
4. Swagger 装饰器与示例
   - 本项目**不拆** `docs/` / examples 文件：`@ApiOperation`、`@ApiProperty` 直接写在 controller 与 DTO 上，不与业务类型文件混杂。

## 导入导出规则

- 仅 TypeScript 编译期使用的类型必须使用 `import type`。
- 运行时需要的 `enum`、常量、数组、映射表使用普通 `import`。
- 类型文件统一显式 `export`，不要使用 default export。
- 避免从 controller 导出类型给 service 使用；controller/service 都应该依赖独立类型文件。
- 避免循环依赖：类型文件不要反向 import controller/service。

## 修改步骤

1. 新建 controller/service 前
   - 先判断需要哪些请求体、查询参数、service options、返回类型。
   - 先创建或更新对应 `*.types.ts` / `*.enums.ts` / `*.constants.ts` 文件。
2. 修改已有 controller/service 时
   - 检查文件顶部是否已有内联 `type`、`interface`、`enum`。
   - 如果本次改动会触碰相关区域，优先顺手抽离到独立文件。
   - 如果新增类型，必须直接写入独立文件，不要继续增加内联类型。
3. 更新引用
   - controller/service 从独立文件导入类型。
   - 类型导入使用 `import type { Xxx } from './xxx.types';`。
   - enum/常量若运行时使用，使用普通 `import { XxxEnum } from './xxx.enums';`。
4. 最小验证
   - TypeScript 无新增编译错误。
   - NestJS 依赖注入、路由、service 调用不受影响。
   - import 顺序与现有代码风格保持一致。

## 例外情况

- 非导出的局部泛型辅助类型如果只在函数内部极小范围使用，且不会影响 controller/service 顶部结构，可视情况保留；但 API 入参/出参、service options/result 不属于例外。
- 第三方库提供的类型别名不需要重新包装；直接 `import type` 即可。
- Prisma 生成类型、Express/NestJS 类型直接从对应包导入，不要复制定义。

## 完成定义

- 新建或修改的 controller/service 文件中没有新增内联业务 `type`、`interface`、`enum`。
- 相关业务类型已放入同目录独立类型/枚举/常量文件。
- controller/service 通过 `import type` 或普通 import 正确引用。
- 未引入循环依赖、无未使用导入、无新增类型错误。
- 文件命名、类型命名与当前模块风格一致。
