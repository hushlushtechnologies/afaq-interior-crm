import config from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...config,
  testMatch: ['leads-crud.spec.ts'],
  outputDir: 'test-results/leads',
  retries: 0,
});
