import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

import type { ApiResponse } from '../api-response.js';

/**
 * 把 Controller 的返回值统一包装成 `{ code, data, message }`。
 *
 * 通过 `APP_INTERCEPTOR` 注册（见 AppModule），因此 e2e 测试里也生效。
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next
      .handle()
      .pipe(map((data) => ({ code: 0, data, message: 'ok' })));
  }
}
