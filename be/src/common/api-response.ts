/**
 * 统一响应体（《项目规划》第 6 节约定）。
 *
 * - 成功：`code = 0`
 * - 失败：`code = HTTP 状态码`（由 AllExceptionsFilter 产出）
 */
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}
