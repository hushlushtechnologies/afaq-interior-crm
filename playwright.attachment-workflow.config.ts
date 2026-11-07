import { defineConfig } from '@playwright/test';
import { loadAuthTestEnvironment } from './tests/helpers/auth-environment';

loadAuthTestEnvironment();

export default defineConfig({
  testDir: './tests/integration',
  testMatch: 'attachment-workflow.spec.ts',
  outputDir: 'test-results/attachment-workflow',
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});