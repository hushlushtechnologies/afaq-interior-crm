import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  testMatch: [
    'quotation-decimal.spec.ts',
    'quotation-pricing.spec.ts',
    'quotation-history.spec.ts',
    'quotation-revisions.spec.ts',
  ],
  outputDir: 'test-results/quotation-unit',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});