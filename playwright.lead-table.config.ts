import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({
  ...config,
  testMatch: ['lead-table.spec.ts'],
  outputDir: 'test-results/lead-table',
  retries: 0,
});
