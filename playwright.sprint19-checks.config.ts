import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: [
    '**/unit/quotation-*.spec.ts',
    '**/integration/quotation-*.spec.ts',
    '**/integration/sprint19-regression.spec.ts',
  ],
  outputDir: 'test-results/sprint19-checks',
  timeout: 60000,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});