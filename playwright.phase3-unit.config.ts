import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const requiredTests = [
  'attachment-bytes.spec.ts',
  'employee-invitation-request.spec.ts',
  'employee-invitation.spec.ts',
  'follow-up-contracts.spec.ts',
  'lead-attachments.spec.ts',
  'lead-bulk.spec.ts',
  'lead-capture.spec.ts',
  'lead-detail-archive.spec.ts',
  'lead-detail-contracts.spec.ts',
  'lead-details.spec.ts',
  'lead-export.spec.ts',
  'lead-import-staging.spec.ts',
  'lead-import.spec.ts',
  'lead-pipeline.spec.ts',
  'lead-query.spec.ts',
  'lead-validation.spec.ts',
  'reminder-contracts.spec.ts',
  'site-visits.spec.ts',
];
for (const file of requiredTests) {
  if (!existsSync(resolve('tests/unit', file)))
    throw new Error(`Required Phase 3 contract file is missing: ${file}`);
}

export default defineConfig({
  testDir: './tests/unit',
  testMatch: requiredTests,
  outputDir: 'test-results/phase3-unit',
  workers: 2,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});