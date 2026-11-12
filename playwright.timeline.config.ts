import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: 'lead-timeline.spec.ts',
  outputDir: 'test-results/timeline',
  retries: 0,
});
