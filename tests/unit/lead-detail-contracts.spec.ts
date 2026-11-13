import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  detailPageSchema,
  detailQuerySchema,
  detailRecordSchema,
  detailSaveSchema,
} from '../../src/features/lead-details/contracts';

const note = {
  lead_id: randomUUID(),
  id: randomUUID(),
  kind: 'note',
  data: { body: 'Internal fixture' },
  created_by: randomUUID(),
  updated_by: randomUUID(),
  version: 1,
  created_at: '2026-11-07T00:00:00+00:00',
  updated_at: '2026-11-07T00:00:00+00:00',
};
const page = { rows: [note], total: 1, page: 0, pageSize: 20, events: [] };

test('response discriminators reject a note body disguised as room or requirements', () => {
  expect(detailRecordSchema.safeParse(note).success).toBe(true);
  for (const kind of ['room', 'requirements', 'file']) {
    expect(detailRecordSchema.safeParse({ ...note, kind }).success).toBe(false);
  }
});
test('record response rejects invented identity fields and invalid versions', () => {
  for (const patch of [
    { public_url: 'https://example.test' },
    { created_by: null },
    { version: 0 },
  ]) {
    expect(detailRecordSchema.safeParse({ ...note, ...patch }).success).toBe(false);
  }
});
test('query defaults to page zero and rejects unsupported contexts or authority', () => {
  expect(detailQuerySchema.parse({ leadId: note.lead_id, kind: 'note' }).page).toBe(0);
  for (const patch of [
    { page: -1 },
    { page: 10001 },
    { kind: 'files' },
    { actorId: note.created_by },
  ]) {
    expect(
      detailQuerySchema.safeParse({ leadId: note.lead_id, kind: 'note', ...patch }).success,
    ).toBe(false);
  }
});
test('page contract bounds record/history collections and supports an empty page with total', () => {
  expect(detailPageSchema.safeParse(page).success).toBe(true);
  expect(detailPageSchema.safeParse({ ...page, rows: [], total: 21, page: 2 }).success).toBe(true);
  expect(
    detailPageSchema.safeParse({ ...page, rows: Array.from({ length: 21 }, () => note) }).success,
  ).toBe(false);
  expect(detailPageSchema.safeParse({ ...page, pageSize: 50 }).success).toBe(false);
  const event = {
    id: 1,
    lead_id: note.lead_id,
    record_id: note.id,
    actor_id: note.created_by,
    action: 'created',
    before_data: null,
    after_data: note,
    occurred_at: note.created_at,
  };
  expect(
    detailPageSchema.safeParse({ ...page, events: Array.from({ length: 51 }, () => event) })
      .success,
  ).toBe(false);
});
test('retry response requires explicit replay status and a complete validated record', () => {
  expect(detailSaveSchema.safeParse({ record: note, replayed: true }).success).toBe(true);
  expect(detailSaveSchema.safeParse({ record: note }).success).toBe(false);
  expect(
    detailSaveSchema.safeParse({ record: { ...note, data: {} }, replayed: false }).success,
  ).toBe(false);
});
