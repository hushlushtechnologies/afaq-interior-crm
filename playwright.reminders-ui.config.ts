import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: 'reminder-ui.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: 'test-results/reminders-ui',
});
