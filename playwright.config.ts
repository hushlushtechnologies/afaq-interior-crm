import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
import { getAuthStatePath, loadAuthTestEnvironment } from './tests/helpers/auth-environment';

loadAuthTestEnvironment();

const baseURL = 'http://127.0.0.1:3100';

const requiredTests = [
  'starter.spec.ts',
  'prototype-production.spec.ts',
  'auth-integration.spec.ts',
  'access-gates.spec.ts',
  'role-controls.spec.ts',
  'security-audit.spec.ts',
  'employee-invitation-ui.spec.ts',
  'employee-invitation-delivery.spec.ts',
  'employee-directory.spec.ts',
];

for (const file of requiredTests) {
  if (!existsSync(resolve('tests/e2e', file))) {
    throw new Error(`Required regression file is missing: ${file}`);
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: requiredTests,
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
        outputFolder: 'playwright-report/production',
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL,
    storageState: getAuthStatePath(baseURL),
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: {
          width: 1280,
          height: 800,
        },
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: {
          width: 390,
          height: 844,
        },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
    url: `${baseURL}/login`,
    env: {
      APP_URL: baseURL,
    },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
