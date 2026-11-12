import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: 'daily-follow-ups.spec.ts',
  outputDir: 'test-results/daily-follow-ups',
  retries: 0,
});
