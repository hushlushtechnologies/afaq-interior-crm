import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  followUpCommandSchema,
  followUpTimeFlags,
  manualActivityCommandSchema,
  salesTimestampSchema,
} from '../../src/features/follow-ups/schemas';
import {
  followUpQuerySchema,
  followUpRowSchema,
  manualActivityRowSchema,
} from '../../src/features/follow-ups/contracts';

const fields = {
  title: 'Discuss room preferences',
  description: null,
  kind: 'call',
  priority: 'normal',
  assigned_user_id: randomUUID(),
  due_at: '2026-11-10T09:00:00Z',
};

const create = {
  requestId: randomUUID(),
  leadId: randomUUID(),
  followUpId: randomUUID(),
  command: 'create',
  version: null,
  data: fields,
};

test('creation preserves stable retry IDs and unknown optional information', () => {
  expect(followUpCommandSchema.parse(create)).toEqual(create);

  expect(
    followUpCommandSchema.parse({ ...create, data: { ...fields, description: ' ' } }).data,
  ).toMatchObject({ description: null });

  for (const patch of [{ version: 1 }, { actorId: randomUUID() }, { status: 'completed' }]) {
    expect(followUpCommandSchema.safeParse({ ...create, ...patch }).success).toBe(false);
  }

  expect(
    followUpCommandSchema.safeParse({ ...create, data: { ...fields, assigned_user_id: null } })
      .success,
  ).toBe(false);
});

test('timestamps reject impossible dates and missing timezone information', () => {
  for (const value of [
    '2026-02-30T10:00:00Z',
    '2026-11-10T24:00:00Z',
    '2026-11-10T10:00',
    '0000-01-01T00:00:00Z',
    '2026-11-10T10:00:00.1234567Z',
  ]) {
    expect(salesTimestampSchema.safeParse(value).success).toBe(false);
  }

  expect(salesTimestampSchema.safeParse('2028-02-29T10:00:00+04:00').success).toBe(true);
});

test('response contracts reject finalized tasks without their evidence', () => {
  const row = {
    ...fields,
    id: randomUUID(),
    lead_id: randomUUID(),
    status: 'open',
    actual_at: null,
    outcome: null,
    cancellation_reason: null,
    completed_activity_id: null,
    finalized_by: null,
    finalized_at: null,
    created_by: randomUUID(),
    created_at: fields.due_at,
    updated_by: randomUUID(),
    updated_at: fields.due_at,
    version: 1,
  };

  expect(followUpRowSchema.safeParse(row).success).toBe(true);

  for (const status of ['completed', 'cancelled']) {
    expect(followUpRowSchema.safeParse({ ...row, status }).success).toBe(false);
  }

  expect(followUpRowSchema.safeParse({ ...row, outcome: 'Forged completion' }).success).toBe(false);
});

test('a completion activity must retain follow-up provenance and outcome', () => {
  const row = {
    id: randomUUID(),
    lead_id: randomUUID(),
    kind: 'follow_up',
    summary: 'Discussion',
    occurred_at: fields.due_at,
    outcome: 'Confirmed next steps',
    notes: null,
    follow_up_id: randomUUID(),
    created_by: randomUUID(),
    created_at: fields.due_at,
  };

  expect(manualActivityRowSchema.safeParse(row).success).toBe(true);

  for (const patch of [{ follow_up_id: null }, { outcome: null }, { kind: 'call' }]) {
    expect(manualActivityRowSchema.safeParse({ ...row, ...patch }).success).toBe(false);
  }
});

test('queries default to my open tasks and reject authority or clock claims', () => {
  expect(followUpQuerySchema.parse({})).toEqual({
    leadId: null,
    page: 0,
    view: 'open',
    mine: true,
  });

  for (const query of [
    { now: fields.due_at },
    { actorId: randomUUID() },
    { page: -1 },
    { page: 100001 },
    { view: 'delivered' },
  ]) {
    expect(followUpQuerySchema.safeParse(query).success).toBe(false);
  }
});

test('ordinary editing cannot bypass a reasoned reschedule command', () => {
  expect(
    followUpCommandSchema.safeParse({ ...create, command: 'update', version: 1 }).success,
  ).toBe(false);

  const { due_at: dueAt, ...details } = fields;

  expect(
    followUpCommandSchema.safeParse({ ...create, command: 'update', version: 1, data: details })
      .success,
  ).toBe(true);

  const reschedule = {
    ...create,
    command: 'reschedule',
    version: 1,
    data: { due_at: dueAt, reason: 'Customer requested another time' },
  };

  expect(followUpCommandSchema.safeParse(reschedule).success).toBe(true);

  expect(
    followUpCommandSchema.safeParse({ ...reschedule, data: { due_at: dueAt, reason: '!!!' } })
      .success,
  ).toBe(false);
});

test('completion requires a nonfuture actual time and meaningful outcome', () => {
  const complete = {
    ...create,
    command: 'complete',
    version: 1,
    data: { actual_at: '2026-01-01T00:00:00Z', outcome: 'Customer confirmed the next discussion' },
  };

  expect(followUpCommandSchema.safeParse(complete).success).toBe(true);

  for (const data of [
    { ...complete.data, outcome: ' ' },
    { ...complete.data, actual_at: new Date(Date.now() + 86400000).toISOString() },
    { ...complete.data, completed_by: randomUUID() },
  ])
    expect(followUpCommandSchema.safeParse({ ...complete, data }).success).toBe(false);
});

test('cancellation requires a reason; requests cannot forge reopening or versions', () => {
  const cancel = {
    ...create,
    command: 'cancel',
    version: 1,
    data: { reason: 'The customer cancelled this follow-up' },
  };

  expect(followUpCommandSchema.safeParse(cancel).success).toBe(true);

  for (const patch of [
    { command: 'reopen' },
    { version: 0 },
    { version: Number.MAX_SAFE_INTEGER + 1 },
    { data: { reason: '' } },
  ]) {
    expect(followUpCommandSchema.safeParse({ ...cancel, ...patch }).success).toBe(false);
  }
});

test('manual communication logs cannot assert integration delivery or duplicate existing event kinds', () => {
  const log = {
    requestId: randomUUID(),
    leadId: randomUUID(),
    activityId: randomUUID(),
    command: 'log',
    data: {
      kind: 'email',
      summary: 'Employee recorded an email discussion',
      occurred_at: '2026-01-01T00:00:00Z',
      outcome: null,
      notes: null,
    },
  };

  expect(manualActivityCommandSchema.safeParse(log).success).toBe(true);

  for (const data of [
    { ...log.data, delivered: true },
    { ...log.data, kind: 'stage_change' },
    { ...log.data, kind: 'site_visit' },
    { ...log.data, kind: 'note' },
  ]) {
    expect(manualActivityCommandSchema.safeParse({ ...log, data }).success).toBe(false);
  }
});

test('Dubai day boundaries and equivalent offsets are independent of host timezone', () => {
  const now = '2026-11-10T20:30:00Z';

  expect(followUpTimeFlags('2026-11-11T00:00:00+04:00', 'open', now)).toMatchObject({
    today: true,
    overdue: true,
  });

  expect(followUpTimeFlags('2026-11-10T19:59:00Z', 'open', now)).toMatchObject({
    today: false,
    overdue: true,
  });

  expect(followUpTimeFlags('2026-11-11T01:00:00+04:00', 'open', now)).toMatchObject({
    today: true,
    upcoming: true,
  });
});

test('exact due time is not overdue; finalized tasks leave open-task views', () => {
  const now = '2026-11-10T09:00:00Z';

  expect(followUpTimeFlags(now, 'open', now)).toMatchObject({
    today: true,
    overdue: false,
    upcoming: true,
  });

  for (const status of ['completed', 'cancelled'] as const) {
    expect(followUpTimeFlags('2026-11-09T09:00:00Z', status, now)).toMatchObject({
      today: false,
      overdue: false,
      upcoming: false,
      [status]: true,
    });
  }

  expect(() => followUpTimeFlags('invalid', 'open', now)).toThrow();
});
