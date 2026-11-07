import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/unit',
  testMatch: 'site-visits.spec.ts',
  outputDir: 'test-results/visits-unit',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});