import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  outputDir: 'test-results/pipeline-unit',
  testMatch: 'lead-pipeline.spec.ts',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});
