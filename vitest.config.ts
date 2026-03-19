import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    include: ['test/**/*.test.ts'],
    exclude: ['e2e/**', '**/node_modules/**'],
  },
});
