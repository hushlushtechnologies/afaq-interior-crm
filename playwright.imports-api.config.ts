import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: 'lead-import-api.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: 'test-results/imports-api',
});
