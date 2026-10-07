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

/**
 * 模型的**输出预算被耗尽**：`finish_reason === 'length'` 且没有正文。
 *
 * 推理模型（如 `deepseek-v4-flash`）的思维链也算进 `max_tokens`，
 * 输入一长、思考一多就会把额度吃光、正文留空。
 * 这类失败**不是上游故障**，重新试只是浪费——正确做法是**放大 max_tokens 再试**。
 */
export class AiOutputTruncatedError extends AiUnavailableError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AiOutputTruncatedError';
  }
}
