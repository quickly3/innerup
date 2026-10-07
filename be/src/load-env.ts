import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

/**
 * 从 `be/.env` 加载环境变量，**不依赖当前工作目录**。
 *
 * 之所以不用 `import 'dotenv/config'`：
 * 1. 后者只按 cwd 找 `.env`，从仓库根目录启动（见根目录 package.json 的脚本）时会读不到；
 * 2. ESM 的 import 会被提升，写在 `main.ts` 顶层的 `loadEnv()` 一定晚于
 *    `app.module.ts`（也就是 `ConfigModule.forRoot()`）的执行 —— 单独放一个模块
 *    并作为**第一个** import，才能保证顺序。
 *
 * 路径解析：`src/load-env.ts`（开发）与 `dist/load-env.js`（生产）都在 `be/` 下一层，
 * 因此 `..` 恒指向 `be/`。
 */
loadEnv({ path: resolve(import.meta.dirname, '..', '.env'), quiet: true });
