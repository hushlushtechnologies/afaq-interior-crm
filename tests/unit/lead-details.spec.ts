import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  detailCommandSchema,
  internalNoteFieldsSchema,
  requirementFieldsSchema,
  roomFieldsSchema,
} from '../../src/features/lead-details/schemas';

const requirements = {
  project_type: null,
  property_type: null,
  location_description: null,
  style_preferences: null,
  material_preferences: null,
  furniture_preferences: null,
  color_preferences: null,
  budget_estimate: null,
  currency: 'AED',
  desired_start_date: null,
  desired_completion_date: null,
  special_instructions: null,
  completion_state: 'not_started',
};
const room = {
  name: 'Living room',
  room_type: null,
  sort_order: 0,
  requirements_notes: null,
  measurement_notes: null,
  deliverables_notes: null,
};
const command = {
  command: 'save_requirements',
  requestId: randomUUID(),
  leadId: randomUUID(),
  version: null,
  data: requirements,
};

test('unknown business information remains nullable; whitespace is normalized', () => {
  expect(requirementFieldsSchema.parse(requirements)).toEqual(requirements);
  expect(
    requirementFieldsSchema.parse({ ...requirements, style_preferences: '   ' }),
  ).toHaveProperty('style_preferences', null);
});

test('dates reject impossible days, year zero and reversed ranges', () => {
  for (const value of ['2026-02-30', '2026-13-01', '0000-01-01', '2026-1-01']) {
    expect(
      requirementFieldsSchema.safeParse({ ...requirements, desired_start_date: value }).success,
    ).toBe(false);
  }
  expect(
    requirementFieldsSchema.safeParse({
      ...requirements,
      desired_start_date: '2026-11-07',
      desired_completion_date: '2026-11-06',
    }).success,
  ).toBe(false);
  expect(
    requirementFieldsSchema.safeParse({
      ...requirements,
      desired_start_date: '2028-02-29',
      desired_completion_date: '2028-02-29',
    }).success,
  ).toBe(true);
});

test('budget remains exact decimal text with the existing AED convention', () => {
  for (const value of ['-1', '1.001', '1e3', '1,000', '1000000000000', 100]) {
    expect(
      requirementFieldsSchema.safeParse({ ...requirements, budget_estimate: value }).success,
    ).toBe(false);
  }
  expect(
    requirementFieldsSchema.parse({ ...requirements, budget_estimate: '0.00' }),
  ).toHaveProperty('budget_estimate', '0.00');
  expect(requirementFieldsSchema.safeParse({ ...requirements, currency: 'USD' }).success).toBe(
    false,
  );
});

test('completion is explicit and does not manufacture mandatory customer details', () => {
  for (const state of ['not_started', 'in_progress', 'completed', 'needs_clarification']) {
    expect(
      requirementFieldsSchema.safeParse({ ...requirements, completion_state: state }).success,
    ).toBe(true);
  }
  expect(
    requirementFieldsSchema.safeParse({ ...requirements, completion_state: 'approved' }).success,
  ).toBe(false);
});

test('room identity is a UUID; repeated names remain legitimate', () => {
  const first = { ...command, command: 'save_room', recordId: randomUUID(), data: room };
  const second = { ...first, recordId: randomUUID() };
  expect(detailCommandSchema.safeParse(first).success).toBe(true);
  expect(detailCommandSchema.safeParse(second).success).toBe(true);
  expect(roomFieldsSchema.safeParse({ ...room, name: '   ' }).success).toBe(false);
  expect(roomFieldsSchema.safeParse({ ...room, sort_order: -1 }).success).toBe(false);
  expect(roomFieldsSchema.safeParse({ ...room, measurement_notes: 'a'.repeat(4001) }).success).toBe(
    false,
  );
});

test('notes require bounded text and reject client supplied authors or visibility', () => {
  expect(internalNoteFieldsSchema.parse({ body: '  Internal only  ' })).toEqual({
    body: 'Internal only',
  });
  for (const data of [
    { body: ' ' },
    { body: 'a'.repeat(4001) },
    { body: 'Text', author_id: randomUUID() },
    { body: 'Text', public: true },
  ]) {
    expect(internalNoteFieldsSchema.safeParse(data).success).toBe(false);
  }
});

test('commands require stable UUIDs and valid record versions', () => {
  expect(detailCommandSchema.parse(command)).toEqual(command);
  expect(detailCommandSchema.safeParse({ ...command, version: 1 }).success).toBe(true);
  for (const patch of [
    { version: 0 },
    { version: 1.5 },
    { requestId: 'bad' },
    { leadId: 'bad' },
    { version: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    expect(detailCommandSchema.safeParse({ ...command, ...patch }).success).toBe(false);
  }
});

test('commands reject authority, stage, cross-record and attachment injection', () => {
  for (const patch of [
    { actorId: randomUUID() },
    { stage: 'won' },
    { serviceKey: 'fake' },
    { role: 'super_admin' },
    { opportunityId: randomUUID() },
  ]) {
    expect(detailCommandSchema.safeParse({ ...command, ...patch }).success).toBe(false);
  }
  expect(
    detailCommandSchema.safeParse({
      ...command,
      data: { ...requirements, file_url: 'https://example.test' },
    }).success,
  ).toBe(false);
  expect(detailCommandSchema.safeParse({ ...command, command: 'delete_lead' }).success).toBe(false);
});
