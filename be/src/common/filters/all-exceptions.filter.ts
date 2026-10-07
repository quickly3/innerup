import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * 全局异常过滤器：把任何异常转成统一响应体，避免把堆栈暴露给前端。
 *
 * - `HttpException`（含 ValidationPipe 抛出的 400）→ 取其 message
 * - 其他异常 → 500 + 通用文案，详细堆栈只写进服务端日志
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      message = this.resolveHttpMessage(exception);
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      code: status,
      data: null,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  /** 兼容 string / { message: string | string[] } 两种异常响应体。 */
  private resolveHttpMessage(exception: HttpException): string {
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const { message } = payload as { message?: unknown };

      if (Array.isArray(message)) {
        return message.join('; ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }

    return exception.message;
  }
}
