import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: 'follow-up-ui.spec.ts',
  outputDir: 'test-results/follow-ups-ui',
  retries: 0,
});
