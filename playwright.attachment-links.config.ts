import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: 'attachment-links.spec.ts',
  outputDir: 'test-results/attachment-links',
  retries: 0,
});