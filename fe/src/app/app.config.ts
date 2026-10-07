import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { apiInterceptor } from './core/interceptors/api.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // 统一 baseURL + 统一响应体解包，见 core/interceptors/api.interceptor.ts
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
  ],
};
