import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({
  ...config,
  testMatch: 'site-visits.spec.ts',
  outputDir: 'test-results/visits',
  retries: 0,
});