import { expect, test } from '@playwright/test';
import { pipelinePageSchema, pipelineQuerySchema } from '../../src/features/leads/query-schemas';

test('defaults preserve the existing active 20-row listing', () => {
  const query = pipelineQuerySchema.parse({});
  expect(query).toMatchObject({
    page: 0,
    pageSize: 20,
    archived: false,
    sort: 'created_at',
    direction: 'desc',
  });
  expect(query.owner).toBeNull();
});
test('filters and sorting reject authority injection and unsupported columns', () => {
  for (const query of [
    { owner: 'someone' },
    { stage: 'approved' },
    { sort: 'password' },
    { direction: 'desc; drop table' },
    { company: 'other' },
    { page: -1 },
    { page: 1.5 },
    { pageSize: 1000 },
    { archived: 'false' },
    { search: 'a'.repeat(101) },
  ])
    expect(pipelineQuerySchema.safeParse(query).success).toBe(false);
});
test('calendar ranges are valid, ordered and inclusive', () => {
  expect(pipelineQuerySchema.safeParse({ from: '2026-02-30' }).success).toBe(false);
  expect(pipelineQuerySchema.safeParse({ from: '2026-11-06', to: '2026-11-05' }).success).toBe(
    false,
  );
  expect(pipelineQuerySchema.safeParse({ from: '2026-11-05', to: '2026-11-05' }).success).toBe(
    true,
  );
});
test('search preserves literal punctuation and supports explicit unassigned filtering', () => {
  const query = pipelineQuerySchema.parse({
    search: '  100%_test  ',
    owner: 'unassigned',
    priority: 'urgent',
  });
  expect(query.search).toBe('100%_test');
  expect(query.owner).toBe('unassigned');
});
test('page contract accepts sparse stage counts and rejects unknown stages', () => {
  const empty = {
    rows: [],
    total: 0,
    page: 0,
    pageSize: 20,
    stageCounts: {},
    sources: [],
    owners: [],
  };
  expect(pipelinePageSchema.safeParse(empty).success).toBe(true);
  expect(pipelinePageSchema.safeParse({ ...empty, stageCounts: { new: 21 } }).success).toBe(true);
  expect(pipelinePageSchema.safeParse({ ...empty, stageCounts: { fake: 1 } }).success).toBe(false);
});
