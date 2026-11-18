import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: [
    '**/unit/quotation-pdf-model.spec.ts',
    '**/unit/quotation-pdf-renderer.spec.ts',
    '**/integration/quotation-pdf-model.spec.ts',
  ],
  outputDir: 'test-results/quotation-pdf',
  timeout: 45000,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});