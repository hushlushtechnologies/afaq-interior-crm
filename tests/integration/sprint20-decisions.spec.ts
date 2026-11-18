import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  quotationReviewSchema,
  reviewDecisionResultSchema,
  reviewDecisionSchema,
} from '../../src/features/quotations/review-contracts';

test('exact decisions preserve reviewed snapshots and require fresh approval for corrected revisions', () => {
  const env = { ...process.env };
  for (const key of [
    'DOCKER_HOST',
    'DOCKER_CONTEXT',
    'DOCKER_TLS',
    'DOCKER_TLS_VERIFY',
    'DOCKER_CERT_PATH',
  ])
    delete env[key];
  const host =
    process.platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock';
  const container = 'supabase_db_afaq-interiors-crm-s09-local';
  function docker(args: string[], input?: string) {
    return execFileSync('docker', [`--host=${host}`, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: 45000,
    });
  }
  expect(
    docker([
      'inspect',
      '--format',
      '{{.Name}}|{{.State.Running}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
      container,
    ]).trim(),
  ).toBe(`/${container}|true|57422`);
  const args = [
    'exec',
    '-i',
    container,
    'psql',
    '-X',
    '-qAt',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ];
  let migration = '';
  for (const [signature, file] of [
    ['public.crm_submit_quotation_review(jsonb)', '20261117000100_sprint20_review_submission.sql'],
    ['public.crm_decide_quotation_review(jsonb)', '20261117000200_sprint20_review_decisions.sql'],
  ]) {
    const installed = docker(args, `select to_regprocedure('${signature}') is not null;`).trim();
    expect(['t', 'f']).toContain(installed);
    if (installed === 'f')
      migration +=
        readFileSync(resolve('supabase/migrations', file), 'utf8')
          .replace(/^begin;\s*$/m, '')
          .replace(/^commit;\s*$/m, '') + '\n';
  }
  const fixture = readFileSync(resolve('tests/sql/sprint20-decisions.sql'), 'utf8').replace(
    'begin;',
    () => `begin;\n${migration}`,
  );
  const result = JSON.parse(docker(args, fixture));
  expect(reviewDecisionResultSchema.parse(result.decision).status).toBe('approved');
  expect(quotationReviewSchema.parse(result.review).isCurrentRevision).toBe(false);
  expect(quotationReviewSchema.parse(result.pending).decision).toBeNull();
  expect(
    reviewDecisionSchema.safeParse({
      requestId: result.decision.id,
      reviewId: result.decision.reviewId,
      expectedRevision: 1,
      expectedSavedVersion: 1,
      decision: 'reject',
      comments: null,
    }).success,
  ).toBe(false);
});