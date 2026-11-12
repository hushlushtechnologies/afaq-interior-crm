import { defineConfig } from '@playwright/test';
import { loadAuthTestEnvironment } from './tests/helpers/auth-environment';

loadAuthTestEnvironment();

export default defineConfig({
  testDir: './tests/integration',
  testMatch: 'reminder-scheduler.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/reminder-scheduler',
});
