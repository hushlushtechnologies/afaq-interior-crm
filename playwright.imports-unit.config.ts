import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  testMatch: ['lead-import.spec.ts', 'lead-import-staging.spec.ts'],
  outputDir: 'test-results/imports-unit',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});
