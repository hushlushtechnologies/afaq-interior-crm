import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  fromDubaiInput,
  toDubaiInput,
  visitCommandSchema,
  visitFieldsSchema,
} from '../../src/features/lead-visits/schemas';
const fields = {
  scheduled_at: '2026-11-07T09:00:00Z',
  assigned_user_id: null,
  location: null,
  notes: null,
  measurements: null,
  observations: null,
};
const base = {
  command: 'create',
  requestId: randomUUID(),
  leadId: randomUUID(),
  visitId: randomUUID(),
  version: null,
  data: fields,
};
test('unknown assignee/location remain nullable and creation starts without a version', () => {
  expect(visitCommandSchema.parse(base)).toEqual(base);
  expect(visitCommandSchema.safeParse({ ...base, version: 1 }).success).toBe(false);
});
test('timestamps require actual calendar dates and explicit timezone', () => {
  for (const value of [
    '2026-02-30T10:00:00Z',
    '2026-11-07T24:00:00Z',
    '2026-11-07T10:00',
    '0000-01-01T00:00:00Z',
  ]) {
    expect(visitFieldsSchema.safeParse({ ...fields, scheduled_at: value }).success).toBe(false);
  }
});
test('Dubai input converts independently of browser or host timezone', () => {
  expect(fromDubaiInput('2026-11-07T13:00')).toBe('2026-11-07T09:00:00.000Z');
  expect(toDubaiInput('2026-11-07T20:00:00Z')).toBe('2026-11-08T00:00');
  expect(fromDubaiInput('2026-02-30T13:00')).toBeNull();
});
test('completion requires nonfuture time and meaningful outcome', () => {
  const command = {
    ...base,
    command: 'complete',
    version: 1,
    data: { actual_at: '2026-01-01T00:00:00Z', outcome: 'Measurements recorded' },
  };
  expect(visitCommandSchema.safeParse(command).success).toBe(true);
  for (const data of [
    { ...command.data, outcome: ' ' },
    { ...command.data, outcome: '!!!' },
    { ...command.data, actual_at: new Date(Date.now() + 86400000).toISOString() },
  ]) {
    expect(visitCommandSchema.safeParse({ ...command, data }).success).toBe(false);
  }
});
test('cancellation requires evidence and rejects identity/terminal-state injection', () => {
  const command = {
    ...base,
    command: 'cancel',
    version: 1,
    data: { reason: 'Client unavailable' },
  };
  expect(visitCommandSchema.safeParse(command).success).toBe(true);
  for (const patch of [
    { data: { reason: ' ' } },
    { data: { reason: 'Reason', cancelled_by: randomUUID() } },
    { status: 'planned' },
    { actorId: randomUUID() },
    { command: 'reopen' },
  ]) {
    expect(visitCommandSchema.safeParse({ ...command, ...patch }).success).toBe(false);
  }
});
