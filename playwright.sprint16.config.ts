import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: [
    ...(config.testMatch as string[]),
    'follow-up-ui.spec.ts',
    'manual-activity-ui.spec.ts',
    'lead-timeline.spec.ts',
    'daily-follow-ups.spec.ts',
  ],
  outputDir: 'test-results/sprint16',
  retries: 0,
});
