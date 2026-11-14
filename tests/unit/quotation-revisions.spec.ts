import { expect, test } from '@playwright/test';
import { createQuotationRevisionSchema } from '../../src/features/quotations/revision-contracts';
import { quotationSavedSchema } from '../../src/features/quotations/contracts';
import { calculateQuotation } from '../../src/features/quotations/pricing';
import { PRICING_POLICY_ID } from '../../src/features/quotations/schemas';

const command = {
  requestId: '00000000-0000-4000-8000-000000000001',
  quotationId: '00000000-0000-4000-8000-000000000002',
  expectedVersion: 7,
  expectedRevision: 2,
  reason: '  Client requested a revision  ',
};

test('revision commands retain both expected counters and normalize the reason', () => {
  expect(createQuotationRevisionSchema.parse(command)).toEqual({
    ...command,
    reason: 'Client requested a revision',
  });
});

test('reasons are mandatory and bounded', () => {
  for (const reason of ['', ' ', null, 1, 'a'.repeat(2001)])
    expect(createQuotationRevisionSchema.safeParse({ ...command, reason }).success).toBe(false);
});

test('expected versions and revisions are positive bounded integers', () => {
  for (const key of ['expectedVersion', 'expectedRevision'])
    for (const value of [0, -1, 1.5, '2', null, 2147483648])
      expect(createQuotationRevisionSchema.safeParse({ ...command, [key]: value }).success).toBe(
        false,
      );
});

test('revision commands reject identities and fields supplied outside the contract', () => {
  expect(
    createQuotationRevisionSchema.safeParse({ ...command, requestId: 'invalid' }).success,
  ).toBe(false);

  expect(
    createQuotationRevisionSchema.safeParse({ ...command, actorId: command.requestId }).success,
  ).toBe(false);
});

test('saved responses accept later draft revisions but reject approval states', () => {
  const value = {
    id: command.quotationId,
    number: 'AFAQ-Q-2026-000001',
    revision: 2,
    version: 8,
    status: 'draft',
    replayed: false,
    calculation: calculateQuotation({
      policyId: PRICING_POLICY_ID,
      currency: 'AED',
      items: [],
      overallDiscount: { mode: 'none' },
    }),
  };

  expect(quotationSavedSchema.safeParse(value).success).toBe(true);
  expect(quotationSavedSchema.safeParse({ ...value, revision: 0 }).success).toBe(false);
  expect(quotationSavedSchema.safeParse({ ...value, status: 'approved' }).success).toBe(false);
});