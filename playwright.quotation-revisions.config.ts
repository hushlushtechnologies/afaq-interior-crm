import { defineConfig } from '@playwright/test';
import config from './playwright.quotations.config';

export default defineConfig({
  ...config,
  testMatch: 'quotation-revisions.spec.ts',
  outputDir: 'test-results/quotation-revisions',
});