import { defineConfig } from '@playwright/test';
import { loadAuthTestEnvironment } from './tests/helpers/auth-environment';

loadAuthTestEnvironment();

export default defineConfig({
  testDir: './tests/integration',
  testMatch: 'follow-up-workflow.spec.ts',
  outputDir: 'test-results/follow-ups',
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});
