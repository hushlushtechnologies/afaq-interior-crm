import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/integration',
  testMatch: 'quotation-concepts.spec.ts',
  outputDir: 'test-results/quotation-concepts',
  timeout: 60000,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});