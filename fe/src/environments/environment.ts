/**
 * 前端环境配置。
 *
 * `apiBaseUrl` 统一为 `/api`：
 * - 开发期由 `proxy.conf.json` 代理到 `http://localhost:3000`
 * - 生产期由 Nginx / 静态托管的反向代理转发
 *
 * 这样代码里永远不用硬编码 `localhost:3000`，也天然规避跨域。
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api',
};
