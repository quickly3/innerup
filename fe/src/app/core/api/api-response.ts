/**
 * 后端统一响应体（《项目规划》第 6 节 · docs/项目规划/06-API设计.md）。
 *
 * 成功：`code === 0`，业务数据在 `data` 里
 * 失败：`code === HTTP 状态码`，`data` 为 null
 *
 * 前端一般不需要直接感知它 —— `apiInterceptor` 会自动解包 `data`。
 */
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}
