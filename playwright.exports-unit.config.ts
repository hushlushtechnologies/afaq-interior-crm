import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  testMatch: 'lead-export.spec.ts',
  outputDir: 'test-results/exports-unit',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});