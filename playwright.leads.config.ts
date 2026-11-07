import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: ['lead-details.spec.ts', 'lead-detail-archive.spec.ts'],
  outputDir: 'test-results/lead-details',
  retries: 0,
});