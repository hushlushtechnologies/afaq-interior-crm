import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const container = 'supabase_db_afaq-interiors-crm-s09-local';
const host =
  process.platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock';
const env = { ...process.env };
for (const key of [
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_TLS',
  'DOCKER_TLS_VERIFY',
  'DOCKER_CERT_PATH',
])
  delete env[key];

function docker(args: string[], input?: string) {
  return execFileSync('docker', [`--host=${host}`, ...args], {
    env,
    input,
    encoding: 'utf8',
    timeout: 45000,
  });
}

test.beforeAll(() => {
  expect(
    docker([
      'inspect',
      '--format',
      '{{.Name}}|{{.State.Running}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
      container,
    ]).trim(),
  ).toBe(`/${container}|true|57422`);
});

for (const file of [
  'last-super-admin.sql',
  'database-authorization.sql',
  'security-audit.sql',
  'leads.sql',
  'lead-pipeline.sql',
  'private-storage.sql',
]) {
  test(`retains existing local protection: ${file}`, () => {
    const fixture = readFileSync(resolve('tests/sql', file), 'utf8');
    if (!/^\s*BEGIN;/im.test(fixture) || !/^\s*ROLLBACK;/im.test(fixture))
      throw new Error('Security regression fixtures must retain their rollback transaction.');
    // psql exits with an error if any existing SQL assertion fails.
    docker(
      [
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
      ],
      fixture,
    );
  });
}