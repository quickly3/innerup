---
name: postman-sync
description: 生成并更新本地 Postman Collection（⚠️ 本项目暂未接入：需先与用户确认并安装 openapi-to-postmanv2 / tsx；脚本须放 be/script/ 且在 be/ 下执行），包含运行示例、输出路径与常见故障排查
triggers:
  - 生成 postman 文件
  - 更新 postman collection
  - 生成 collection
  - 从 API 生成 Postman 集合
  - 根据 Swagger 生成 Postman 文件
  - 自动同步 Postman 集合
  - generate postman collection
  - sync postman collection
---

# Postman Collection 同步 Skill

## ⚠️ 本项目（InnerUp）暂不适用

本仓库**没有接入 Postman 同步**，下列内容在动手前必须先与用户确认：

| 需要的东西 | 本项目现状 |
| --- | --- |
| `be/script/sync-postman.ts` | ❌ 不存在（原件在 `.github/skills/postman-sync/sync-postman.ts`，需复制并改造） |
| `be/package.json` 的 `postman:async` | ❌ 不存在 |
| `openapi-to-postmanv2` 依赖 | ❌ 未安装（属新增依赖，需用户同意） |
| Postman collection 产物目录 | ❌ 不存在 |

> ⚠️ 上面这些是**别的项目（bean-engine / sc-nc-be）的路径**，本项目对应的是
> `be/src/app.module.ts`、`be/output/innerup.postman.collection.json`，且必须兼容 ESM。

如果只是想在 Postman 里调接口，本项目**更省事的做法**是：启动 `be` 后打开
`http://localhost:3000/docs`，用 Swagger UI 直接试，或从 Swagger 页面导出 OpenAPI JSON 手动导入 Postman。

下面是接入该脚本时的参考说明。

这是用于生成并更新本地 Postman Collection 的说明文档。项目内使用的脚本位于 `be/script/sync-postman.ts`，可通过 npm 脚本触发。

**主要目的**：自动从 NestJS 的 Swagger/OpenAPI 文档生成 Postman Collection，方便在 Postman 中导入并调用 API。

**脚本位置**：
- `be/script/sync-postman.ts`（需把 `.github/skills/postman-sync/sync-postman.ts` 复制过去）
- **必须在 `be/` 目录下执行**：脚本按 cwd 解析输出路径，并用相对路径加载 `AppModule`

**输出文件**：
- `be/output/innerup.postman.collection.json`（脚本会确保目录存在并覆盖写入）

**命令（推荐）**：

⚠️ `be/package.json` 目前**没有** `postman:async` 脚本，需要先新增（改 `package.json` 前先与用户确认）：

```json
"postman:async": "node --import tsx script/sync-postman.ts"
```

加好之后在 `be/` 目录下运行：

```bash
cd be
npm run postman:async
```

如果仓库没有对应 npm 脚本，请使用下面的替代命令直接运行（本项目是 ESM，`ts-node` 直跑需额外 loader，
因此推荐 `tsx`；`tsx` 未安装，安装前先征得同意）：

```bash
cd be
npx tsx script/sync-postman.ts
```

**脚本功能要点**：
- 使用 Nest 的 `SwaggerModule.createDocument()` 从运行时 AppModule 生成 OpenAPI JSON。
- 使用 `openapi-to-postmanv2` 将 OpenAPI 转为 Postman Collection。
- 将 collection 中的每个请求名替换为真实的 route path，便于识别。
- 写入到 `be/output/innerup.postman.collection.json`。

**环境与前置条件**：
- 需要在能启动 Nest 应用的 Node 环境下运行（脚本会短暂创建 Nest 应用上下文）
- 用 TypeScript 直接运行需安装 `tsx`（**不在 `be/devDependencies`**，安装前先征得用户同意），
  以及 `openapi-to-postmanv2`（同样未安装）
- 若脚本报错，请确保 `be/src/app.module.ts` 已注册 controller / providers。本项目启动不依赖外部服务；
  `PrismaService` 连不上库时只记日志不崩溃，不影响 Swagger 文档生成

**运行示例**：

```bash
# 在 be/ 目录下执行
cd be
npm run postman:async

# 输出示例
# Postman collection updated: D:\www\innerup\be\output\innerup.postman.collection.json
```

**常见问题与排查**：
- 错误：`Failed to convert OpenAPI to Postman collection` —— 检查 `openapi-to-postmanv2` 的输入是否为合法的 OpenAPI JSON，尝试把 `openApiDocument` 写到临时文件并用 validator 校验。
- 错误：Nest 应用启动卡住/报依赖注入错误 —— 临时在 `AppModule` 中注入 `ConfigModule.forRoot({ ignoreEnvFile: true })` 或在脚本中 mock 需要的配置；或在脚本中捕获并记录更详细的错误堆栈。
- 输出 collection 请求路径不正确 —— 脚本中有 `renameApiItemsByRoutePath` 函数，会把请求名改为 `path` 数组拼接的结果；如路由使用变量或 basePath，确认 `item.request.url.path` 是否为预期结构。

**建议的改进点（可选）**：
- 增加一个 CLI 参数以指定输出路径（默认 `be/output/innerup.postman.collection.json`）。
- 支持仅生成某个 tag/分组的 collection（通过过滤 OpenAPI paths）。
- 在 CI/CD 中加入步骤，自动在 master/main 分支变更时更新 collection 并提交到仓库。

如果你希望，我可以：
- 把该说明同步到 `be/README.md`；
- 为 `be/script/sync-postman.ts` 增加 CLI 参数支持（输出路径、包含/排除 tag）；
- 检查并（如需要）在 `be/package.json` 中添加或修正 `postman:async` 脚本。
