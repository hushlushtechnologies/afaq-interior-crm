import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  testMatch: 'lead-capture.spec.ts',
  outputDir: 'test-results/capture-unit',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});