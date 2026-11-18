import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/unit',
  testMatch: 'quotation-pdf-workflow.spec.ts',
  outputDir: 'test-results/quotation-pdf-workflow',
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});