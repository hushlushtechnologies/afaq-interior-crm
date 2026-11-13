import { defineConfig } from '@playwright/test';
import config from './playwright.sprint16.config';

export default defineConfig({
  ...config,
  testMatch: [
    ...(config.testMatch as string[]),
    'lead-import-api.spec.ts',
    'lead-import-ui.spec.ts',
  ],
  outputDir: 'test-results/imports-ui',
  retries: 0,
});
