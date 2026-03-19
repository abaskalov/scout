import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:10009',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  // Server must be started manually before running E2E:
  //   pnpm dev:all
  // Or use webServer config to auto-start:
  webServer: {
    command: 'pnpm dev',
    port: 10009,
    timeout: 15_000,
    reuseExistingServer: true,
  },
});
