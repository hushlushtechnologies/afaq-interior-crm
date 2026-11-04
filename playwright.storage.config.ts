import { defineConfig } from '@playwright/test';
import { loadAuthTestEnvironment } from './tests/helpers/auth-environment';

loadAuthTestEnvironment();

export default defineConfig({
  testDir: './tests/integration',
  testMatch: ['private-storage.spec.ts', 'local-test-safety.spec.ts'],
  outputDir: 'test-results/storage',
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: { trace: 'off', screenshot: 'off', video: 'off' },
});