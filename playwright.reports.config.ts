import { defineConfig } from '@playwright/test';
import config from './playwright.imports-ui.config';

export default defineConfig({
  ...config,
  testMatch: [...(config.testMatch as string[]), 'lead-reports.spec.ts'],
  outputDir: 'test-results/reports',
  retries: 0,
});