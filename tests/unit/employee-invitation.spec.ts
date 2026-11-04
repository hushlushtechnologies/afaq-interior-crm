import { expect, test } from '@playwright/test';
import { employeeInvitationSchema } from '../../src/features/employee/invitation-schemas';

const validInvitation = {
  displayName: 'Example Employee',
  workEmail: 'employee@example.test',
};

test('normalizes invitation input without changing the employee name', () => {
  expect(
    employeeInvitationSchema.parse({
      displayName: '  Example Employee  ',
      workEmail: '  EMPLOYEE@EXAMPLE.TEST  ',
    }),
  ).toEqual(validInvitation);
});

test('supports employee names in Arabic', () => {
  expect(
    employeeInvitationSchema.parse({
      ...validInvitation,
      displayName: 'محمد أحمد',
    }).displayName,
  ).toBe('محمد أحمد');
});

test('rejects missing and blank required fields', () => {
  for (const input of [
    {},
    { ...validInvitation, displayName: '   ' },
    { ...validInvitation, workEmail: '   ' },
  ]) {
    expect(employeeInvitationSchema.safeParse(input).success).toBe(false);
  }
});

test('enforces the employee name length boundary', () => {
  expect(
    employeeInvitationSchema.safeParse({ ...validInvitation, displayName: 'A'.repeat(120) })
      .success,
  ).toBe(true);

  expect(
    employeeInvitationSchema.safeParse({ ...validInvitation, displayName: 'A'.repeat(121) })
      .success,
  ).toBe(false);
});

test('rejects control characters inside employee names', () => {
  for (const displayName of ['Example\nEmployee', 'Example\tEmployee', 'Example\u0000Employee']) {
    expect(employeeInvitationSchema.safeParse({ ...validInvitation, displayName }).success).toBe(
      false,
    );
  }
});

test('rejects invalid or oversized email addresses', () => {
  for (const workEmail of [
    'not-an-email',
    'employee@example.test\nother@example.test',
    `${'a'.repeat(245)}@example.test`,
  ]) {
    expect(employeeInvitationSchema.safeParse({ ...validInvitation, workEmail }).success).toBe(
      false,
    );
  }
});

test('rejects client-supplied authority, credentials, and redirect destinations', () => {
  for (const extra of [
    { actorId: '00000000-0000-4000-8000-000000000001' },
    { roles: ['super_admin'] },
    { employmentStatus: 'active' },
    { password: 'must-not-be-accepted' },
    { redirectTo: 'https://example.test' },
  ]) {
    expect(employeeInvitationSchema.safeParse({ ...validInvitation, ...extra }).success).toBe(
      false,
    );
  }
});

test('rejects non-string input instead of coercing values', () => {
  for (const input of [
    null,
    [],
    { ...validInvitation, displayName: 123 },
    { ...validInvitation, workEmail: ['employee@example.test'] },
  ]) {
    expect(employeeInvitationSchema.safeParse(input).success).toBe(false);
  }
});