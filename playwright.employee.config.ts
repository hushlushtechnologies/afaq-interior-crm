import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/unit',
  testMatch: ['employee-invitation.spec.ts', 'employee-invitation-request.spec.ts'],
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: 'list',
});