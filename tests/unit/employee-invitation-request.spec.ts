import { expect, test } from '@playwright/test';
import {
  invitationRequestSchema,
  invitationResultSchema,
} from '../../src/features/employee/invitation-request';

const id = '00000000-0000-4000-8000-000000000001';

const input = {
  requestId: id,
  displayName: 'Example Employee',
  workEmail: 'EMPLOYEE@EXAMPLE.TEST',
};

test('requires a UUID request ID and rejects caller-supplied authority', () => {
  expect(invitationRequestSchema.parse(input).workEmail).toBe('employee@example.test');

  for (const invalid of [
    { ...input, requestId: 'invalid' },
    { displayName: input.displayName, workEmail: input.workEmail },
    { ...input, requestedBy: id },
    { ...input, roles: ['super_admin'] },
  ]) {
    expect(invitationRequestSchema.safeParse(invalid).success).toBe(false);
  }
});

test('accepts only consistent queue outcomes', () => {
  for (const status of ['queued', 'already_pending']) {
    expect(
      invitationResultSchema.safeParse({
        status,
        invitationId: id,
        workEmail: input.workEmail,
      }).success,
    ).toBe(true);

    expect(
      invitationResultSchema.safeParse({
        status,
        invitationId: null,
        workEmail: input.workEmail,
      }).success,
    ).toBe(false);
  }

  expect(
    invitationResultSchema.safeParse({
      status: 'account_exists',
      invitationId: null,
      workEmail: input.workEmail,
    }).success,
  ).toBe(true);

  expect(
    invitationResultSchema.safeParse({
      status: 'account_exists',
      invitationId: id,
      workEmail: input.workEmail,
    }).success,
  ).toBe(false);
});

test('does not accept delivery claims or credentials in a queue response', () => {
  expect(
    invitationResultSchema.safeParse({
      status: 'sent',
      invitationId: id,
      workEmail: input.workEmail,
    }).success,
  ).toBe(false);

  expect(
    invitationResultSchema.safeParse({
      status: 'queued',
      invitationId: id,
      workEmail: input.workEmail,
      token: 'unexpected',
    }).success,
  ).toBe(false);
});