/**
 * AI 「暂时不可用」：未配置 Key、网络超时、上游报错、返回结构不合约定。
 *
 * 调用方应据此**降级**（例如退回手动录入），而不是把它当成 500 服务端 bug。
 * 见《项目规划》第 8.2 节的「结果缓存 / 降级」。
 */
export class AiUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AiUnavailableError';
  }
}
