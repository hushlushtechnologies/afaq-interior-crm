import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  reminderQuerySchema,
  reminderReadInputSchema,
  reminderPageSchema,
} from '../../src/features/reminders/contracts';

test('reminder requests cannot supply a recipient or worker authority', () => {
  expect(reminderQuerySchema.parse({})).toEqual({ page: 0 });

  for (const value of [{ recipient_id: randomUUID() }, { page: -1 }, { generate: true }]) {
    expect(reminderQuerySchema.safeParse(value).success).toBe(false);
  }

  expect(
    reminderReadInputSchema.safeParse({ id: randomUUID(), recipient_id: randomUUID() }).success,
  ).toBe(false);
});

test('reminder responses require generic text and valid timestamp evidence', () => {
  const row = {
    id: randomUUID(),
    lead_id: randomUUID(),
    follow_up_id: randomUUID(),
    due_at: '2026-01-01T00:00:00Z',
    created_at: '2026-11-11T00:00:00Z',
    read_at: null,
    title: 'Follow-up due',
  };

  const page = { rows: [row], total: 1, unread: 1, page: 0, pageSize: 20 };

  expect(reminderPageSchema.safeParse(page).success).toBe(true);

  for (const patch of [
    { title: 'Customer secret' },
    { due_at: 'not-a-date' },
    { read_at: 'invalid' },
  ]) {
    expect(reminderPageSchema.safeParse({ ...page, rows: [{ ...row, ...patch }] }).success).toBe(
      false,
    );
  }
});
