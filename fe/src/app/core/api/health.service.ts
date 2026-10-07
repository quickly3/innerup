import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

/** `GET /api/health` 的解包后数据结构 */
export interface HealthStatus {
  status: string;
  database: 'up' | 'down';
  /** 进程已运行秒数 */
  uptime: number;
  /** ISO 时间戳 */
  timestamp: string;
}

/**
 * 健康检查服务 —— 用于确认「前端 → 后端 → 数据库」整条链路。
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  /** 路径不加 `/api` 前缀：由 `apiInterceptor` 统一补全。 */
  check(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>('/health');
  }
}
