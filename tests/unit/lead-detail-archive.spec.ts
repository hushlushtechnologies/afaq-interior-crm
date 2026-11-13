import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { archiveDetailSchema } from '../../src/features/lead-details/archive-schemas';
const input = { requestId: randomUUID(), leadId: randomUUID(), recordId: randomUUID(), version: 1 };
test('archive preserves an exact request and record version', () => {
  expect(archiveDetailSchema.parse(input)).toEqual(input);
});
test('archive rejects missing identity, bad versions and injected authority', () => {
  for (const patch of [
    { version: 0 },
    { version: null },
    { version: 1.5 },
    { recordId: 'bad' },
    { actorId: randomUUID() },
    { role: 'super_admin' },
    { data: { archived_at: null } },
  ]) {
    expect(archiveDetailSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  }
});
test('archive version remains an exact JavaScript integer', () => {
  expect(
    archiveDetailSchema.safeParse({ ...input, version: Number.MAX_SAFE_INTEGER + 1 }).success,
  ).toBe(false);
});
