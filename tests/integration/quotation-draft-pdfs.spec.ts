import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('local PDF lifecycle, retries, audit and restrictive Storage guards', () => {
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
  let fixture = readFileSync(resolve('tests/sql/quotation-draft-pdfs.sql'), 'utf8');
  const installed = docker(
    args,
    "select to_regprocedure('public.crm_draft_pdf_gateway(uuid,text,jsonb)') is not null;",
  ).trim();
  expect(['t', 'f']).toContain(installed);
  if (installed === 'f') {
    // Rehearse the complete additive migration inside the fixture transaction.
    // Its bucket, functions, tables and policies are rolled back with the test.
    const migration = readFileSync(
      resolve('supabase/migrations/20261116000100_sprint19_draft_pdf_storage.sql'),
      'utf8',
    )
      .replace(/^begin;\s*$/m, '')
      .replace(/^commit;\s*$/m, '');
    fixture = fixture.replace('begin;', () => `begin;\n${migration}`);
  }
  const output = docker(args, fixture);
  expect(output).toContain('quotation draft PDF security checks passed');
});