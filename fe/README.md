# InnerUp 前端（fe/）

InnerUp 的 Web 前端。以游戏化界面承载「任务线 / 打卡 / 角色面板」等交互。

- 上层规划见 [`../docs/项目规划.md`](../docs/项目规划.md)
- 后端说明见 [`../be/README.md`](../be/README.md)

---

## 技术栈（当前实际版本）

| 用途 | 选型 | 实际安装版本 |
| --- | --- | --- |
| 框架 | Angular（standalone 组件 + Signals，**zoneless**） | `22.2.x` |
| 构建 | Angular CLI（`@angular/build` + esbuild） | `22.2.x` |
| 语言 | TypeScript | `6.0.x` |
| 路由 | Angular Router（`provideRouter` + 懒加载） | — |
| 状态 | Signals + 服务 | — |
| HTTP | `HttpClient`（`provideHttpClient(withFetch())` + `HttpInterceptorFn`） | — |
| UI | Angular Material（Material 3，`mat.theme()`） | `22.2.x` |
| 样式 | SCSS | — |
| 图表 | ngx-echarts（技能雷达图、打卡热力图，M5 起使用） | 已安装 |
| 单测 | Vitest（Angular 22 默认，无需 karma/jasmine） | `5.x` |

> ⚠️ 本项目使用**现代 Angular**，不是 AngularJS（1.x，已停止维护）。
> Angular 22 默认 **zoneless**（无 zone.js），变更检测靠 Signals 与事件绑定驱动。

## 环境要求

- **Node.js ≥ 20**（推荐 22 LTS），当前验证版本 `22.23.2`
- **npm ≥ 10**（当前 `10.9.8`）
- 无需全局安装 Angular CLI，统一用 `npx @angular/cli`

## 快速开始

```bash
cd fe
npm install          # 已包含 @angular/material / ngx-echarts / echarts
npm start            # http://localhost:4200
```

前端通过 `proxy.conf.json` 把 `/api` 转发到后端 `http://localhost:3000`，
所以**请同时启动 `be/`**（`cd be && npm run start:dev`）。

打开 http://localhost:4200 会看到「环境自检」卡片，它会调用 `GET /api/health`：

- 绿色 <kbd>后端 API</kbd> = 前后端已连通
- <kbd>PostgreSQL</kbd> 显示「未连接」= 后端 `be/.env` 还没填 `DATABASE_URL`

## 环境与代理

`proxy.conf.json`（已在 `angular.json` 的 `serve.options.proxyConfig` 中引用，
因此 `ng serve` 自动带代理）：

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

`src/environments/environment.ts`：

```ts
export const environment = {
  production: false,
  apiBaseUrl: '/api', // 开发期走代理；生产由 Nginx 反向代理
};
```

## 目录结构

```text
fe/
├─ angular.json                 # 构建配置（serve 已挂 proxyConfig）
├─ proxy.conf.json              # 开发代理：/api → localhost:3000
└─ src/
   ├─ main.ts                   # bootstrapApplication
   ├─ index.html
   ├─ styles.scss               # 全局样式 + Material 3 主题（mat.theme()）
   ├─ environments/
   │  └─ environment.ts         # apiBaseUrl
   └─ app/
      ├─ app.config.ts          # provideRouter / provideHttpClient / 拦截器
      ├─ app.routes.ts          # 路由（全部懒加载）
      ├─ app.ts / .html / .scss # 应用外壳（工具栏 + router-outlet）
      ├─ core/
      │  ├─ api/                # 各资源 HTTP 服务（health.service.ts ...）
      │  ├─ interceptors/       # api.interceptor.ts：baseURL + 响应解包
      │  └─ state/              # Signals 状态服务（后续）
      ├─ shared/                # 复用组件、管道、指令（后续）
      ├─ features/
      │  └─ dashboard/          # 角色面板（M1 阶段做环境自检）
      └─ ui/                    # 经验条、雷达图、热力图等展示组件（后续）
```

## 开发约定

- **组件一律用 standalone**，不写 NgModule。
- **状态优先用 Signals**：`signal()` / `computed()` / `effect()`；跨页面共享放进 `core/state/`。
- **依赖注入用 `inject()`** 函数式写法，而非构造函数参数。
- **新组件加 `changeDetection: ChangeDetectionStrategy.OnPush`**（zoneless 下的好习惯）。
- **HTTP 统一走 `core/api/` 里的服务**，组件不直接用 `HttpClient`。
- 服务里写**相对路径**（如 `'/health'`），**不要写 `/api` 前缀、更不要硬编码 `localhost:3000`** ——
  `apiInterceptor` 会统一补全 baseURL 并解包 `{ code, data, message }`，业务代码直接拿 `data`。
- 路由按 `features/` **懒加载**：`loadComponent: () => import('./features/x/x').then(m => m.X)`。
- 提交前跑 `npm run build` 与 `npm test`。

### 一个最小示例

```ts
// core/api/goal.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface Goal {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'done';
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly http = inject(HttpClient);

  // 注意：路径不写 /api，由 apiInterceptor 补全并解包 data
  list() {
    return this.http.get<Goal[]>('/goals');
  }

  create(title: string) {
    return this.http.post<Goal>('/goals', { title });
  }
}
```

## 与后端联调

1. 启动后端：`cd be && npm run start:dev`，确认 http://localhost:3000/api/health 可访问。
2. 打开 Swagger：http://localhost:3000/docs 查看接口定义。
3. 前端接口路径统一以 `/` 开头，**不要在组件里硬编码 `localhost:3000`**。
4. AI 生成任务线等耗时接口注意加 loading 与超时提示。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动开发服务器（自动带 `/api` 代理） |
| `npm run build` | 生产构建，产物在 `dist/fe/browser` |
| `npm test` | 单元测试（Vitest） |
| `npx ng generate component features/goals/goal-list` | 生成 standalone 组件 |

> 本项目的 `package.json` 没有 `lint` 脚本：Angular CLI 已不再内置 TSLint/ESLint，
> 需要时用 `ng add @angular/eslint` 单独接入。

## 构建与部署

```bash
npm run build            # 产物：dist/fe/browser
```

部署到 Nginx / 静态托管时注意：

- 配置 SPA 回退：所有未匹配路由返回 `index.html`
- 生产环境由 Nginx 反向代理 `/api` 到后端 Node 进程（`apiBaseUrl` 保持 `/api`），
  或把 `environment.ts` 的 `apiBaseUrl` 改成真实后端地址
