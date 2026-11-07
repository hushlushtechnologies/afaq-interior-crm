import { expect, test } from '@playwright/test';
import { leadFieldsSchema, leadCommandSchema } from '../../src/features/leads/schemas';

const valid = {
  customer_name: 'Example Customer',
  email: null,
  phone: null,
  alternate_phone: null,
  source_code: 'manual',
  assigned_user_id: null,
  priority: 'normal',
  property_type: null,
  location: null,
  budget: null,
  expected_start_on: null,
  inquiry_on: '2026-11-05',
  follow_up_on: null,
  description: null,
  initial_note: null,
};

test('unknown contact, property and budget remain null', () => {
  const result = leadFieldsSchema.parse(valid);
  expect(result.budget).toBeNull();
  expect(result.email).toBeNull();
  expect(result.phone).toBeNull();
});

test('normalizes email but never invents country codes or merges names', () => {
  expect(leadFieldsSchema.parse({ ...valid, email: 'Customer@EXAMPLE.TEST' }).email).toBe(
    'customer@example.test',
  );
  expect(leadFieldsSchema.safeParse({ ...valid, phone: '0501234567' }).success).toBe(false);
  expect(leadFieldsSchema.safeParse({ ...valid, phone: '+971501234567' }).success).toBe(true);
});

test('rejects invalid AED amounts without rounding or coercion', () => {
  for (const budget of ['-1', '1.001', 'Infinity', '1e3', '1000000000000', 100])
    expect(leadFieldsSchema.safeParse({ ...valid, budget }).success).toBe(false);

  expect(leadFieldsSchema.safeParse({ ...valid, budget: '0.00' }).success).toBe(true);
});

test('rejects invalid calendar dates and missing required information', () => {
  for (const data of [
    { inquiry_on: '2026-02-30' },
    { expected_start_on: '2026-13-01' },
    { customer_name: ' ' },
    { priority: 'critical' },
  ])
    expect(leadFieldsSchema.safeParse({ ...valid, ...data }).success).toBe(false);
});

test('rejects client-supplied identity, stage, credentials and provenance fields', () => {
  for (const extra of [
    { stage: 'won' },
    { created_by: crypto.randomUUID() },
    { external_id: 'fake' },
    { serviceKey: 'fake' },
  ])
    expect(leadFieldsSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
});

test('assignment and archive cannot smuggle a generic update', () => {
  const request = { requestId: crypto.randomUUID(), leadId: crypto.randomUUID(), version: 1 };

  expect(
    leadCommandSchema.safeParse({
      ...request,
      command: 'assign',
      data: { assigned_user_id: null, stage: 'won' },
    }).success,
  ).toBe(false);

  expect(
    leadCommandSchema.safeParse({ ...request, command: 'archive', data: { delete: true } }).success,
  ).toBe(false);

  expect(leadCommandSchema.safeParse({ ...request, command: 'archive', data: {} }).success).toBe(
    true,
  );
});
