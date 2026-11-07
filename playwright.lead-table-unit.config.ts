import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/unit',
  testMatch: ['lead-query.spec.ts', 'lead-bulk.spec.ts'],
  outputDir: 'test-results/lead-table-unit',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});
