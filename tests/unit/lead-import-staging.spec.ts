import { expect, test } from '@playwright/test';
import { prepareLeadImport } from '../../src/features/lead-import/prepare';
import {
  importBatchSchema,
  importConfirmInputSchema,
  importPageSchema,
} from '../../src/features/lead-import/contracts';

const id = 'b811f203-2fc6-4d13-a903-00c85ee90890';
const metadata = {
  requestId: id,
  filename: 'fixture.csv',
  mapping: { customer_name: 0, email: 1 },
  sourceCode: 'manual',
  assignedUserId: null,
  defaultInquiryOn: '2026-11-12',
};
const batch = {
  id,
  filename: 'fixture.csv',
  sourceCode: 'manual',
  assignedUserId: null,
  createdAt: '2026-11-12T10:00:00Z',
  confirmationEnabled: true,
  version: 1,
  status: 'staged',
  completedAt: null,
  counts: { total: 1, ready: 1, invalid: 0, review: 0, applied: 0, skipped: 0 },
};

test('server preparation reparses original bytes and stores field errors without invalid raw values', async () => {
  const prepared = await prepareLeadImport(
    metadata,
    new TextEncoder().encode('Name,Email\nAlex,A@example.test\nX,secret-invalid'),
  );
  expect(prepared.payload.rows[0].data?.email).toBe('a@example.test');
  expect(prepared.payload.rows[1].data).toBeNull();
  expect(prepared.payload.rows[1].errors).toEqual(['customer_name', 'email']);
  expect(JSON.stringify(prepared.payload)).not.toContain('secret-invalid');
  expect(prepared.payload.fileHash).toMatch(/^[a-f0-9]{64}$/);
});

test('unchanged original bytes produce a stable hash; browser row and actor injection are rejected', async () => {
  const bytes = new TextEncoder().encode('Name,Email\nAlex,a@example.test');
  const first = await prepareLeadImport(metadata, bytes);
  const second = await prepareLeadImport(metadata, bytes);
  expect(first).toEqual(second);
  expect(
    (await prepareLeadImport(metadata, new TextEncoder().encode('Name,Email\nSam,a@example.test')))
      .payload.fileHash,
  ).not.toBe(first.payload.fileHash);
  for (const key of ['rows', 'actorId', 'stage', 'fileHash']) {
    await expect(prepareLeadImport({ ...metadata, [key]: 'forged' }, bytes)).rejects.toThrow();
  }
});

test('batch contracts require reconciled counts and the approved confirmation flag', () => {
  expect(importBatchSchema.safeParse(batch).success).toBe(true);
  expect(importBatchSchema.safeParse({ ...batch, confirmationEnabled: false }).success).toBe(false);
  expect(
    importBatchSchema.safeParse({ ...batch, counts: { ...batch.counts, review: 1 } }).success,
  ).toBe(false);
});

test('confirmation accepts explicit skips and rejects duplicates, invalid versions and hidden operations', () => {
  const input = { requestId: id, batchId: id, version: 1, skips: [2, 5] };
  expect(importConfirmInputSchema.safeParse(input).success).toBe(true);
  for (const extra of [
    { skips: [2, 2] },
    { skips: [1] },
    { version: 0 },
    { merge: true },
    { override: true },
  ]) {
    expect(importConfirmInputSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  }
});

test('applied row history can redact a lead after access changes without inventing an accessible ID', () => {
  const page = {
    batch: {
      ...batch,
      status: 'completed',
      version: 2,
      completedAt: '2026-11-12T10:01:00Z',
      counts: { total: 1, ready: 0, invalid: 0, review: 0, applied: 1, skipped: 0 },
    },
    page: 0,
    pageSize: 20,
    events: [],
    rows: [
      {
        row_number: 2,
        data: null,
        errors: [],
        status: 'applied',
        duplicate_rows: [],
        database_match: false,
        resulting_lead_id: null,
        redacted: true,
      },
    ],
  };
  expect(importPageSchema.safeParse(page).success).toBe(true);
  expect(
    importPageSchema.safeParse({ ...page, rows: [{ ...page.rows[0], redacted: false }] }).success,
  ).toBe(false);
});
