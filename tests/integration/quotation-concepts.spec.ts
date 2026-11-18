import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  conceptPageSchema,
  conceptSavedSchema,
  conceptCommandSchema,
} from '../../src/features/quotations/concept-contracts';

test('local concept authorization, provenance, retries, revision protection and archive history', () => {
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
  let fixture = readFileSync(resolve('tests/sql/quotation-concepts.sql'), 'utf8');
  const installed = docker(
    args,
    "select to_regprocedure('public.crm_save_quotation_concept(jsonb)') is not null;",
  ).trim();
  expect(['t', 'f']).toContain(installed);
  if (installed === 'f') {
    const migration = readFileSync(
      resolve('supabase/migrations/20261116000200_sprint19_concept_references.sql'),
      'utf8',
    )
      .replace(/^begin;\s*$/m, '')
      .replace(/^commit;\s*$/m, '');
    fixture = fixture.replace('begin;', () => `begin;\n${migration}`);
  }
  const output = JSON.parse(docker(args, fixture));
  const active = conceptPageSchema.parse(output.active);
  const archived = conceptPageSchema.parse(output.archived);
  expect(conceptSavedSchema.parse(output.saved).archived).toBe(true);
  expect(active.rows[0].origin).toBe('existing_reference');
  expect(active.rows[0].generationState).toBe('not_requested');
  expect(archived.rows[0].selected).toBe(false);
  expect(active.generation.confirmedCost).toBeNull();
  expect(
    conceptCommandSchema.safeParse({ command: 'generate', provider: 'unapproved' }).success,
  ).toBe(false);
  expect(JSON.stringify(output)).not.toContain('storage_path');
});