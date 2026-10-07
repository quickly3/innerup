import {
  HttpErrorResponse,
  HttpResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { map } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../api/api-response';

/**
 * 统一 HTTP 拦截器，承担两件事：
 *
 * 1. **补全 baseURL**：请求路径以 `/` 开头时，自动加上 `environment.apiBaseUrl`，
 *    组件里只写 `/health`、`/goals` 这种相对路径。
 * 2. **解包统一响应体**：后端返回 `{ code, data, message }`，这里把 `data` 抽出来，
 *    业务代码直接拿到模型对象；`code !== 0`（HTTP 200 但业务失败）时转成错误。
 */
export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const url = request.url.startsWith('/')
    ? `${environment.apiBaseUrl}${request.url}`
    : request.url;

  return next(request.clone({ url })).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse)) {
        return event;
      }

      const body = event.body as ApiResponse<unknown> | null;

      // 非统一响应体（例如静态资源）原样放行
      if (!body || typeof body !== 'object' || !('code' in body)) {
        return event;
      }

      if (body.code !== 0) {
        throw new HttpErrorResponse({
          status: body.code,
          statusText: body.message,
          error: body,
          url,
        });
      }

      return event.clone({ body: body.data });
    }),
  );
};
