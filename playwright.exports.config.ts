import { defineConfig } from '@playwright/test';
import config from './playwright.reports.config';

export default defineConfig({
  ...config,
  testMatch: [...(config.testMatch as string[]), 'lead-exports.spec.ts'],
  outputDir: 'test-results/exports',
  retries: 0,
});