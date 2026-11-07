import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  testMatch: [
    'lead-details.spec.ts',
    'lead-detail-contracts.spec.ts',
    'lead-detail-archive.spec.ts',
  ],
  outputDir: 'test-results/lead-details-unit',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});