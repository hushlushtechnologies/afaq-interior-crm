import { defineConfig } from '@playwright/test';
import { getAuthStatePath, loadAuthTestEnvironment } from './tests/helpers/auth-environment';

loadAuthTestEnvironment();

const baseURL = 'http://127.0.0.1:3102';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'shell.spec.ts',
  globalSetup: './tests/auth.setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'playwright-report/shell',
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL,
    storageState: getAuthStatePath(baseURL),
    browserName: 'chromium',
    viewport: {
      width: 1440,
      height: 1000,
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3102',
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
