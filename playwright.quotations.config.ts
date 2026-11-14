import { defineConfig } from '@playwright/test';
import { loadAuthTestEnvironment } from './tests/helpers/auth-environment';

loadAuthTestEnvironment();

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'quotations.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  outputDir: 'test-results/quotations',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    browserName: 'chromium',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
    storageState: { cookies: [], origins: [] },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/login',
    timeout: 180000,
    reuseExistingServer: false,
    env: { APP_URL: 'http://127.0.0.1:3100' },
  },
});
