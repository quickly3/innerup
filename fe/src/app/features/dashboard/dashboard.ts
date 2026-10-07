import type { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { HealthService, type HealthStatus } from '../../core/api/health.service';

/**
 * 角色面板（Dashboard）。
 *
 * M1 阶段它只做一件事：把「前端 → 后端 → 数据库」的链路状态显示出来，
 * 作为脚手架跑通的证据。M5 起会替换成真正的等级 / XP / 今日任务面板。
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly healthService = inject(HealthService);

  protected readonly health = signal<HealthStatus | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.refresh();
  }

  /** 重新探测后端健康状态。 */
  protected refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    this.healthService.check().subscribe({
      next: (health) => {
        this.health.set(health);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.health.set(null);
        this.error.set(this.describeError(error));
        this.loading.set(false);
      },
    });
  }

  /** 把 HttpErrorResponse 翻译成对开发者有用的提示。 */
  private describeError(error: unknown): string {
    const httpError = error as Partial<HttpErrorResponse>;

    // status 0：请求根本没到达后端（后端没启动 / 代理没生效）
    if (httpError.status === 0) {
      return '无法连接后端。请先在 be/ 目录执行 npm run start:dev';
    }

    const payload = httpError.error as { message?: unknown } | string | null | undefined;
    if (typeof payload === 'string') {
      return payload;
    }
    if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
      return payload.message;
    }

    return httpError.message ?? '未知错误';
  }
}
