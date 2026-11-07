import { expect, test } from '@playwright/test';
import { pipelineCommandSchema } from '../../src/features/leads/pipeline-schemas';

const base = { requestId: crypto.randomUUID(), leadId: crypto.randomUUID(), version: 1 };

test('accepts every approved pre-quotation destination', () => {
  for (const stage of ['new', 'assigned', 'contacted', 'requirements', 'site-visit'])
    expect(
      pipelineCommandSchema.safeParse({ ...base, command: 'move', data: { stage } }).success,
    ).toBe(true);
});

test('rejects protected destinations and caller-supplied authority', () => {
  for (const stage of ['quotation-shared', 'negotiation', 'won', 'lost'])
    expect(
      pipelineCommandSchema.safeParse({ ...base, command: 'move', data: { stage } }).success,
    ).toBe(false);

  expect(
    pipelineCommandSchema.safeParse({
      ...base,
      command: 'move',
      data: { stage: 'new', created_by: base.leadId },
    }).success,
  ).toBe(false);
});

test('Other requires a nonblank explanation', () => {
  for (const explanation of [null, '', ' \n\t'])
    expect(
      pipelineCommandSchema.safeParse({
        ...base,
        command: 'lose',
        data: { reasonCode: 'other', explanation },
      }).success,
    ).toBe(false);

  expect(
    pipelineCommandSchema.safeParse({
      ...base,
      command: 'lose',
      data: { reasonCode: 'other', explanation: 'Customer-specific explanation' },
    }).success,
  ).toBe(true);
});

test('Lost details are bounded and reject extra fields', () => {
  expect(
    pipelineCommandSchema.safeParse({
      ...base,
      command: 'lose',
      data: { reasonCode: 'cancelled', note: 'x'.repeat(2001) },
    }).success,
  ).toBe(false);

  expect(
    pipelineCommandSchema.safeParse({
      ...base,
      command: 'lose',
      data: { reasonCode: 'cancelled', stage: 'won' },
    }).success,
  ).toBe(false);
});

test('reopening requires a reason and preserves request identity', () => {
  expect(
    pipelineCommandSchema.safeParse({ ...base, command: 'reopen', data: { reason: ' \n ' } })
      .success,
  ).toBe(false);

  const parsed = pipelineCommandSchema.parse({
    ...base,
    command: 'reopen',
    data: { reason: ' Customer resumed ' },
  });

  expect(parsed.requestId).toBe(base.requestId);
  expect(parsed.data).toEqual({ reason: 'Customer resumed' });
});
