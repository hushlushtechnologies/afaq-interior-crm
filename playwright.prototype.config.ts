import { defineConfig } from '@playwright/test';
import { getAuthStatePath, loadAuthTestEnvironment } from './tests/helpers/auth-environment';

loadAuthTestEnvironment();

const baseURL = 'http://127.0.0.1:3103';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'prototype.spec.ts',
    'component-library.spec.ts',
    'overlay-library.spec.ts',
    'feedback-files.spec.ts',
    'auth.spec.ts',
    'recovery.spec.ts',
    'verification.spec.ts',
  ],
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
        outputFolder: 'playwright-report/prototype',
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
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3103',
    url: `${baseURL}/login`,
    env: {
      APP_URL: baseURL,
    },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
