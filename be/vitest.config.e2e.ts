import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // 端到端用例会真实读写远端 PostgreSQL，往返延迟远高于纯内存用例
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
