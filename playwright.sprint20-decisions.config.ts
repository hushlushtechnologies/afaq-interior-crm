import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/integration',
  testMatch: [
    'sprint20-preflight.spec.ts',
    'sprint20-submissions.spec.ts',
    'sprint20-decisions.spec.ts',
    'sprint20-review-concurrency.spec.ts',
  ],
  outputDir: 'test-results/sprint20-decisions',
  timeout: 60000,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});