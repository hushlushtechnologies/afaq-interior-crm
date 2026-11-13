import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
import config from './playwright.exports.config';

const requiredTests = config.testMatch as string[];
if (new Set(requiredTests).size !== requiredTests.length)
  throw new Error('The Phase 3 regression selection contains duplicate test entries.');
for (const file of requiredTests) {
  if (!existsSync(resolve('tests/e2e', file)))
    throw new Error(`Required Phase 3 regression file is missing: ${file}`);
}

export default defineConfig({
  ...config,
  testMatch: requiredTests,
  outputDir: 'test-results/phase3',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/phase3', open: 'never' }],
  ],
  retries: 0,
});