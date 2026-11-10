import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: 'lead-attachments.spec.ts',
  outputDir: 'test-results/attachments',
  retries: 0,
});