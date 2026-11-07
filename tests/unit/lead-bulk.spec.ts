import { expect, test } from '@playwright/test';
import { bulkAssignmentSchema } from '../../src/features/leads/bulk-schemas';
const row = { id: crypto.randomUUID(), version: 1 };
const valid = { requestId: crypto.randomUUID(), owner: null, rows: [row] };
test('accepts explicit unassigned state with a stable request ID', () => {
  expect(bulkAssignmentSchema.parse(valid)).toEqual(valid);
});
test('rejects empty, oversized, duplicate and stale-shaped selections', () => {
  for (const rows of [
    [],
    [row, row],
    Array.from({ length: 51 }, () => ({ id: crypto.randomUUID(), version: 1 })),
    [{ ...row, version: 0 }],
    [{ ...row, version: 1.5 }],
  ])
    expect(bulkAssignmentSchema.safeParse({ ...valid, rows }).success).toBe(false);
});
test('rejects injected stage, creator, credentials and owner shapes', () => {
  expect(
    bulkAssignmentSchema.safeParse({ ...valid, rows: [{ ...row, stage: 'won' }] }).success,
  ).toBe(false);
  expect(bulkAssignmentSchema.safeParse({ ...valid, created_by: row.id }).success).toBe(false);
  expect(bulkAssignmentSchema.safeParse({ ...valid, serviceKey: 'fake' }).success).toBe(false);
  expect(bulkAssignmentSchema.safeParse({ ...valid, owner: 'someone' }).success).toBe(false);
});
