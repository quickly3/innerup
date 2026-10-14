/**
 * 把 `HttpErrorResponse` 翻译成给用户看的提示（M3 起统一用这一份）。
 *
 * `apiInterceptor` 解包统一响应体时，把业务失败转成了 `HttpErrorResponse`，
 * 所以后端 `AllExceptionsFilter` 的 `message` 在 `error.error.message` 里。
 */
export function describeHttpError(error: unknown): string {
  const httpError = error as {
    status?: number;
    error?: { message?: unknown };
    message?: string;
  };

  if (httpError?.status === 0) {
    return '无法连接后端，请确认后端已启动（be/ 下 npm run start:dev）';
  }

  const message = httpError?.error?.message;
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }
  if (typeof message === 'object' && message !== null) {
    // class-validator 的字段错误：ValidationPipe 会返回 string[]
    const first = (message as unknown as string[])[0];
    if (typeof first === 'string') return first;
  }
  if (httpError?.message) {
    return httpError.message;
  }

  return '出了点问题，请稍后再试';
}
