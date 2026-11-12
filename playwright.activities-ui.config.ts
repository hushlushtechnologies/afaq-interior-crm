import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: ['manual-activity-ui.spec.ts', 'follow-up-ui.spec.ts'],
  outputDir: 'test-results/activities-ui',
  retries: 0,
});
