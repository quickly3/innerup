---
name: create-cli
description: 创建 CLI 命令（⚠️ 本项目暂无 nest-commander / CLI 脚手架，动手前必须先与用户确认；文中已标注 InnerUp 适配的路径与 ESM 注意事项）
---

# 创建 CLI 命令

## ⚠️ 本项目（InnerUp）暂不适用

本仓库**目前没有 CLI 基础设施**。动手前必须先与用户确认：

| 需要的东西 | 本项目现状 |
| --- | --- |
| `nest-commander` 依赖 | ❌ 未安装（属新增依赖，需用户同意） |
| `be/src/cli.ts` 入口 | ❌ 不存在 |
| `be/src/commands/` 目录 | ❌ 不存在 |
| `be/package.json` 的 `cli` 脚本 | ❌ 不存在（只有 `build` / `start:dev` / `test` / `prisma:*` / `lint` / `format`） |
| 路径别名（`tsconfig-paths`） | ❌ `be/tsconfig.json` 没有 `paths` |
| `ts-node` | ⚠️ 全局有，但不在 `be/devDependencies`，且本项目是 **ESM**，直跑需额外 loader |

**结论**：本项目确实需要一次性脚本时，优先用「在对应业务域 service 里写逻辑 + 一个临时脚本 +
Vitest 测试」的轻量做法，而不是引入完整 CLI 框架。若用户明确要求建 CLI，再按下面的通用指引落地，
并把上表每一项与用户确认。

## 适用场景（引入 CLI 之后）

- 需要新增一个可通过 `npm run cli` 执行的命令行任务
- 需要为现有命令组添加新的子命令
- 需要创建独立的一次性命令（如数据迁移、同步脚本）

## 执行原则

- 先确认是新增命令文件还是在已有命令中追加子命令
- **command 只做流程调度和参数传递，业务逻辑必须放到对应 service 中**
- **优先复用已有 service**：先在 `be/src/` 下按业务域搜索（本项目是 `be/src/growth/`、`be/src/ai/`、
  `be/src/health/`、`be/src/prisma/` 这类结构，**没有** `src/application/` 或 `src/microservices/` 分层），
  有则直接注入调用；无则在对应域目录下新建
- command 中不应出现文件读写、数据库操作、第三方调用等具体实现细节
- command 中的私有方法仅用于调用 service 方法，不做数据处理
- **command 向 service 传参时只传 `options` 对象**，不逐个拆字段；service 方法签名接收 `options?: { ... }` 并在内部解构取值
- 如果现有业务 service 依赖过重（含 `@Cron`、队列 processor/listener、`@Event` 订阅器等副作用），应抽出无副作用的纯逻辑 provider/service 给 CLI 使用
- 编写 CLI 或一次性脚本时，必须避免引入会在应用启动时产生副作用的 module 或 service，例如队列监听、`@Cron` 定时任务、`@Event`/事件订阅器、消息消费者、webhook listener 等
- CLI module 应保持最小依赖，只注册本次命令实际需要的 command/service/provider，避免导入完整业务 module 导致意外任务被启动
- 变更最小化，只修改与需求直接相关的文件

## 技术栈

- 使用 `nest-commander` 库（`Command`、`CommandRunner`、`Option` 装饰器）
- CLI 入口：**`be/src/cli.ts`** → `CommandFactory.run(...)`（需新建）
- 命令文件目录：**`be/src/commands/`**（需新建）
- `be/package.json` 需新增脚本，并注意本项目是 **ESM**：
  - ⚠️ 本仓库**没有** `tsconfig-paths` 的 `paths` 别名，不要照搬
    `-r tsconfig-paths/register`；一律用**带 `.js` 后缀的相对导入**
  - ESM 下推荐 `node --import tsx be/src/cli.ts`（`tsx` 需先安装并征得用户同意）
- 一次性脚本也可放 `be/script/`，按需在 `be/package.json` 挂脚本
- 命令注册模块：以 `be/src/cli.ts` 实际加载的 CLI module 为准

## 命令模式

项目中有两种命令模式：

### 模式一：带子命令的复合命令（推荐）

适用于同一领域下有多个操作的场景（如 `ai`、`spider`），通过 `-c` 参数分发子命令。

```typescript
import { Command, CommandRunner, Option } from 'nest-commander';
// 本项目用带 .js 后缀的相对导入（无路径别名）
import { XxxService } from '../growth/xxx.service.js';

@Command({
  name: 'xxx',
  description:
    'xxx 相关命令入口。使用 `npm run cli -- xxx --help` 查看帮助，使用 `npm run cli -- xxx -c <command>` 执行具体子命令。',
})
export class XxxCommand extends CommandRunner {
  constructor(
    private readonly xxxService: XxxService,
  ) {
    super();
  }

  async run(_passedParam: string[], options?: any): Promise<void> {
    void _passedParam;

    if (!options?.command) {
      this.printRuntimeGuide();
      return;
    }

    switch (options.command) {
      case 'sub1':
        await this.xxxService.doSomething();
        console.log('sub1 完成');
        process.exit(0);
        break;
      case 'sub2':
        const result = await this.xxxService.doOther();
        console.log(result);
        process.exit(0);
        break;
      default:
        console.log(`未找到子命令: ${options.command}`);
        this.printRuntimeGuide();
        break;
    }
  }

  @Option({
    flags: '-c, --command [command]',
    description: '要执行的子命令，例如 sub1、sub2',
  })
  getSubCommand(val: string): string {
    return val;
  }

  private printRuntimeGuide() {
    console.log('XxxCommand 运行说明:');
    console.log('for linux npm run cli xxx -- -c <command>');
    console.log('for windows  npm run cli -- xxx -- -c <command>');
    console.log('');
    console.log('可用子命令:');

    for (const item of this.getCommandDescriptions()) {
      console.log(`  ${item.name.padEnd(20, ' ')}${item.description}`);
    }

    console.log('');
    console.log('示例:');
    console.log('  npm run cli -- xxx -- -c sub1');
  }

  private getCommandDescriptions() {
    return [
      { name: 'sub1', description: '子命令1的描述' },
      { name: 'sub2', description: '子命令2的描述' },
    ];
  }
}
```

> **注意**：在 `switch/case` 中直接调用 service 方法并打印结果，不需要额外包装私有方法。每个 case 执行完毕后调用 `process.exit(0)` 退出进程。

### 模式二：单一命令

适用于职责单一、不需要子命令分发的场景。

```typescript
import { Command, CommandRunner } from 'nest-commander';
import { XxxService } from '../growth/xxx.service.js';

@Command({
  name: 'xxx:action',
  description: '该命令的描述',
})
export class XxxCommand extends CommandRunner {
  constructor(
    private readonly xxxService: XxxService,
  ) {
    super();
  }

  async run(_passedParam: string[], _options?: any): Promise<void> {
    void _passedParam;
    void _options;
    await this.xxxService.doSomething();
  }
}
```

## 标准步骤

1. **确定命令归属**
   - 查看 `be/src/commands/` 下是否已有同领域的命令文件
   - 若已有，在对应文件中新增子命令（switch case + getCommandDescriptions 条目）
   - 若不存在，创建新文件 `be/src/commands/{domain}.command.ts`

2. **查找或确定 service**
   - **先搜索已有 service**：在 `be/src/` 下按业务域关键词搜索（如 `be/src/growth/`）
   - 找到已有 service → 直接在其中新增方法，command 注入该 service 调用
   - 未找到 → 在 `be/src/{domain}/` 下新建 service 文件
   - service 方法包含所有业务逻辑（文件读写、数据处理、数据库操作等）
   - command 中不应出现任何业务实现代码

3. **编写命令类**
   - 使用 `@Command()` 装饰器定义命令名称和描述
   - 继承 `CommandRunner`，实现 `run()` 方法
   - 通过构造函数注入所需的 service
   - `run()` 方法中只做：参数校验 → switch/case 分发 → 调用 service 方法 → 打印结果
   - 如果需要子命令，添加 `@Option()` 装饰器、`switch/case` 分发、`printRuntimeGuide()` 和 `getCommandDescriptions()`
   - **command 中不要出现 `fs`、`readCsvFile`、`prisma` 等具体实现导入**

4. **注册到 CLI module**
   - 先查看 `be/src/cli.ts`，确认 `CommandFactory.run(...)` 实际加载的 module
   - 在实际 CLI module 中：
     - 添加命令类的 import 语句
     - 将命令类加入 `providers` 数组
     - 如有新 service，同样加入 `providers` 数组
     - 如复用已有 service，确认该 service 已在 module 中注册，或补注册
     - 不要为了省事直接 import 可能包含 `@Cron`、队列 processor/listener、`@Event` 订阅器、消息消费者等副作用 provider 的完整业务 module

5. **最小验证**
   - 编译通过，无新增类型错误
   - 命令可通过 `npm --prefix be run cli -- {name} --help` 查看帮助
   - 子命令可通过 `npm --prefix be run cli -- {name} -- -c {subcommand}` 执行
   - Windows 下多一层 `--`：`npm run cli -- xxx -- -c sub1`

## 输出要求（完成定义）

- 命令类已在 `be/src/commands/` 下创建或更新
- 对应 service 方法已实现并被命令调用
- **command 中不包含任何业务实现代码**（文件读写、数据处理、数据库操作等均在 service 中）
- **优先复用已有 service**，如有新 service 则在对应领域目录下创建
- 实际 CLI module 注册完整，依赖注入可用（以 `src/cli.ts` 中 `CommandFactory.run(...)` 加载的 module 为准）
- CLI module/service 依赖已做副作用检查，不会因执行 CLI 意外启动队列监听、`@Cron`、`@Event` 订阅器、消息消费者等常驻任务
- `be/package.json` 的 CLI 脚本指向实际入口，并适配 ESM（**不要**照搬 `tsconfig-paths` 写法）
- 包含 `printRuntimeGuide()` 和 `getCommandDescriptions()` 提供使用指引（复合命令模式）
- 命名、目录与现有代码风格保持一致
- 导入路径使用**带 `.js` 后缀的相对路径**（本项目未配置路径别名）

