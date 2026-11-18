import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  quotationReviewSchema,
  reviewSubmissionResultSchema,
} from '../../src/features/quotations/review-contracts';

test('submission freezes evidence and grants only the named PM scoped review access', () => {
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
  const installed = docker(
    args,
    "select to_regprocedure('public.crm_submit_quotation_review(jsonb)') is not null;",
  ).trim();
  expect(['t', 'f']).toContain(installed);
  let fixture = readFileSync(resolve('tests/sql/sprint20-submissions.sql'), 'utf8');
  if (installed === 'f') {
    const migration = readFileSync(
      resolve('supabase/migrations/20261117000100_sprint20_review_submission.sql'),
      'utf8',
    )
      .replace(/^begin;\s*$/m, '')
      .replace(/^commit;\s*$/m, '');
    fixture = fixture.replace('begin;', () => `begin;\n${migration}`);
  }
  const result = JSON.parse(docker(args, fixture));
  expect(reviewSubmissionResultSchema.parse(result.saved).status).toBe('pending');
  const review = quotationReviewSchema.parse(result.review);
  expect(review.reviewerId).not.toBe(review.creatorId);
  expect(review.reviewerId).not.toBe(review.editorId);
  expect(review.reviewerId).not.toBe(review.submittedBy);
  expect(review.evidence?.images).toHaveLength(1);
  expect(JSON.stringify(review)).not.toContain('storage_path');
});