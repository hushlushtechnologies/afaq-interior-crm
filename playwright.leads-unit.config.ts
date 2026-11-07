import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  outputDir: 'test-results/leads-unit',
  testMatch: 'lead-validation.spec.ts',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});
