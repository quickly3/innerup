---
name: create-api
description: 在 InnerUp 后端（NestJS 12 + ESM）新增 API 时参考：controller 只做路由与参数接收、逻辑下沉 service、入参用 class-validator DTO + @ApiProperty、返回值交给全局拦截器包装、并在 module 注册；本项目不使用独立 docs 文件、不使用 RBAC 角色装饰器。
---

# 创建 API（InnerUp / `be/`）

## 适用场景

- 需要新增一个 NestJS 接口（查询、创建、更新、删除等）
- 需要在 controller 与 service 之间建立清晰调用链
- 需要确保新建 controller / service 在 module 中正确注册

## 前置约束（本项目硬规则，不可绕过）

- **全局前缀 `/api`**：controller 只写去掉前缀的路径（`@Controller('map')`），不要自己写 `/api`。
- **统一响应体**：返回值由 `TransformInterceptor` 包成 `{ code, data, message }`。**controller / service 直接 `return` 业务对象**，不要自己拼这个壳。
- **统一异常**：抛 `BadRequestException` / `NotFoundException` 等 `HttpException` 即可，`AllExceptionsFilter` 会转成统一错误结构并隐藏堆栈。
- **入参一律用 DTO**：全局 `ValidationPipe({ whitelist: true, transform: true })`，所以入参用 `class-validator` DTO，并加 `@ApiProperty` 让 Swagger 有文档。
- **ESM 项目**：所有相对导入**必须带 `.js` 后缀**（`import { GrowthService } from './growth.service.js'`），否则构建失败。第三方包不带后缀。
- **用户隔离**：业务层不要自己写死用户 id，一律调 `CurrentUserService.ensureUserId()`；列表查询务必带 `where: { userId }`。
- **主键**：数据库主键统一 `cuid()`（见 `be/prisma/schema.prisma`）。
- **AI 失败**：涉及 AI 的失败一律抛 `AiUnavailableError`，由业务层降级并转成 503 + 提示文案（参考 `growth/map-ingest.service.ts`），不要变成 500。

## 执行原则

- 先确认归属模块，优先复用现有 controller 与 service
- **controller 保持薄**：只做路由、参数接收、调用 service；参数解析、校验、筛选拼装、数据转换、事务等一律下沉到 service
- 业务逻辑放在 service，方法命名与 API 语义一致
- **HTTP 动词用语义化的那个**（不用「一律 POST」）：读取用 `@Get()`、创建用 `@Post()`、局部更新用 `@Patch()`、删除用 `@Delete()`；现有代码即此风格（见 `be/src/growth/growth.controller.ts`）
- 路由名直接表达作用，并与 controller 方法名保持一致（如 `createFocus()` ↔ `@Post('focus')`、`update()` ↔ `@Patch(':kind/:id')`）
- 新增方法**追加在文件内同类方法的下方**（若已有分组，插到该组末尾），不要打乱现有阅读顺序
- Swagger 描述**内联写在 controller 上**（`@ApiTags` + `@ApiOperation` + `@ApiParam` / `@ApiBody`）；**本项目不拆 `*.controller.docs.ts` 文件**
- 类型定义按 `controller-service-types` skill 抽离（DTO 放模块的 `dto/` 目录）
- 分页接口按 `pagination-format` skill 返回 `page / pageSize / total`
- 接口一旦变更，**同一改动里**同步 `docs/项目规划/06-API设计.md`（必要时 `13-成长地图.md` 的 13.8）
- 变更最小化，只修改与需求直接相关的文件

## 标准步骤

1. **定位目标模块与现有文件**
   - 在 `be/src/<domain>/` 下找 `*.controller.ts`、`*.service.ts`、`*.module.ts`、`dto/`
   - 若不存在，则在 `be/src/<domain>/` 下创建（目录结构见 `docs/项目规划/10-目录结构.md`）

2. **在 controller 中新增路由方法**
   - 用语义化的 `@Get` / `@Post` / `@Patch` / `@Delete`，路径不带 `/api`
   - 入参用 `@Body() dto: XxxDto` / `@Param()` / `@Query()`，DTO 从 `./dto/xxx.dto.js` 导入
   - 方法体只写一行 `return this.<service>.<method>(...)`
   - 补 `@ApiOperation({ summary, description })`；路径参数用 `@ApiParam`（枚举可 `enum: XxxEnum`）；上传用 `@ApiConsumes` + `@ApiBody`
   - 新方法写在现有同类方法下方，保持分组顺序

3. **新增 / 更新 DTO**
   - 位置：`be/src/<domain>/dto/*.dto.ts`（与现有 `growth/dto/create-item.dto.ts` 一致）
   - `class-validator` 装饰器做校验，`@ApiProperty` 提供 Swagger 描述与示例
   - 不传 `createdAt` / `updatedAt`（时间字段由服务端维护，只出现在响应里）

4. **在 service 中新增对应方法**
   - 方法名与 controller 调用一致
   - 新方法追加在文件内现有相关方法的下方
   - 在这里实现校验、条件组装、`prisma` 访问、事务、AI 降级等全部逻辑

5. **完成依赖注入与模块注册**
   - 在 `be/src/<domain>/<domain>.module.ts` 的 `controllers` / `providers` 注册
   - 跨模块调用只通过被 `exports` 的 service；补齐 `imports`
   - 全局管道 / 拦截器 / 过滤器在 `app.module.ts` 里用 `APP_PIPE` / `APP_INTERCEPTOR` / `APP_FILTER` 注册，不要用 `main.ts` 的 `useGlobal*`

6. **最小验证**
   - `npm --prefix be run build` 编译通过，无新增类型错误
   - `npm --prefix be run test`（Vitest）通过
   - `npm --prefix be run lint`（oxlint，type-aware）无新增告警
   - 起服务后 `/docs` 能看到新接口，用真实请求确认响应体是 `{ code, data, message }`

## 本项目「不适用 / 需先确认」的写法

以下来自通用 skill 模板，**在 InnerUp 中不要照做**：

| 模板写法 | 本项目做法 |
| --- | --- |
| 所有接口统一 `@Post('<action>')` | 用语义化 HTTP 动词（`@Get` / `@Post` / `@Patch` / `@Delete`） |
| Swagger 抽到独立 `src/controller/docs/*.controller.docs.ts` | **不拆文件**，`@ApiOperation` 等内联在 controller |
| `@Roles(...)` / `RolesGuard` / `UserRoleName`（RBAC） | **本项目单用户免登录，没有权限体系**。需要引入角色体系时，先与用户确认再设计 |
| `openapi-to-postmanv2` / Postman collection 导出 | 本项目未接入，见 `postman-sync` skill |
| `src/` 绝对路径别名（`tsconfig-paths`） | 本项目**没有** `paths` 别名，一律用带 `.js` 后缀的相对导入 |

## 输出要求（完成定义）

- 路由已在 controller 暴露，路径不带 `/api` 前缀
- 对应 service 方法已实现并被 controller 调用，controller 保持薄
- 新方法已按现有分组顺序追加，未打乱原有布局
- module 注册完整，依赖注入可用
- DTO 已用 `class-validator` + `@ApiProperty` 定义，类型未内联在 controller / service（见 `controller-service-types`）
- 返回业务对象，未手写 `{ code, data, message }`
- 列表查询带 `where: { userId }`；涉及分页时字段为 `page / pageSize / total`
- `docs/项目规划/06-API设计.md` 已同步
- 命名、目录、导入风格与现有代码一致
