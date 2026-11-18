import { defineConfig } from '@playwright/test';
import config from './playwright.quotations.config';
export default defineConfig({
  ...config,
  testMatch: 'quotation-concepts-ui.spec.ts',
  outputDir: 'test-results/quotation-concepts-ui',
  webServer: {
    ...config.webServer,
    command: 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/login',
    timeout: 180000,
    reuseExistingServer: false,
    env: {
      APP_URL: 'http://127.0.0.1:3100',
      ENABLE_LOCAL_QUOTATION_CONCEPTS: 'true',
      ENABLE_LOCAL_LEAD_ATTACHMENTS: 'true',
    },
  },
});