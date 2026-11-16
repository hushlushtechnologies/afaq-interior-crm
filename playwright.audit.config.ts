import { defineConfig } from '@playwright/test';
import config from './playwright.quotations.config';

export default defineConfig({
  ...config,
  testMatch: [
    'quotations.spec.ts',
    'quotation-history.spec.ts',
    'quotation-revisions.spec.ts',
    'audit-repairs.spec.ts',
  ],
  outputDir: 'test-results/audit',
  webServer: {
    ...config.webServer,
    command: 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/login',
    timeout: 180000,
    reuseExistingServer: false,
    env: {
      APP_URL: 'http://127.0.0.1:3100',
      ENABLE_LOCAL_LEAD_CAPTURE: 'false',
    },
  },
});