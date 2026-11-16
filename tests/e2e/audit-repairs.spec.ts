import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createLeadFixtures } from '../helpers/lead-fixtures';

function withoutTransaction(sql: string) {
  return sql.replace(/^\s*(?:begin|commit|rollback);\s*$/gim, '');
}

test('forward repair handles both missing and previously installed revision functions', async ({
  baseURL,
}) => {
  createLeadFixtures(baseURL!);

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

  const file = readFileSync(
    'supabase/migrations/20261113000400_sprint18_draft_workflow.sql',
    'utf8',
  );

  const start = file.indexOf('create function public.crm_save_quotation_draft');
  const end = file.indexOf('create function public.crm_get_quotation', start);

  if (start < 0 || end < 0) throw new Error('Expected original save definition not found.');

  const original = file
    .slice(start, end)
    .replace(
      'create function public.crm_save_quotation_draft',
      'create or replace function public.crm_save_quotation_draft',
    )
    .replace(/as \$\$\r?\n/, () => 'as $$\n<<crm_save_quotation_draft>>\n');

  const repair = withoutTransaction(
    readFileSync('supabase/migrations/20261114000300_sprint19_revision_repair.sql', 'utf8'),
  );

  const checks = withoutTransaction(readFileSync('tests/sql/quotation-revisions.sql', 'utf8'));

  const input = `begin;
    set local statement_timeout='45s';
    select pg_advisory_xact_lock(90310001::bigint);

    drop function if exists public.crm_create_quotation_revision(jsonb);

    alter table crm_quotes.drafts
      drop constraint if exists draft_revision_fk;

    alter table crm_quotes.drafts
      drop constraint drafts_revision_check;

    alter table crm_quotes.drafts
      add constraint drafts_revision_check check(revision=1) not valid;

    ${original}

    do $$ begin
      if to_regprocedure('public.crm_create_quotation_revision(jsonb)') is not null then
        raise exception 'Missing-function reproduction failed';
      end if;
    end; $$;

    ${repair}
    ${repair}
    ${checks}

    rollback;`;

  const output = execFileSync(
    'docker',
    [
      `--host=${host}`,
      'exec',
      '-i',
      'supabase_db_afaq-interiors-crm-s09-local',
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
    { env, input, encoding: 'utf8', timeout: 60000 },
  );

  expect(output).toContain('quotation revision checks passed');
});

test('canonical capture routes resolve and stay disabled without local authorization', async ({
  request,
  baseURL,
}) => {
  createLeadFixtures(baseURL!);

  const id = '00000000-0000-4000-8000-000000000001';

  for (const path of [
    '/api/integrations/website/leads',
    '/api/integrations/capture-worker',
    `/api/integrations/meta/${id}`,
  ]) {
    const response = await request.post(path, { data: {} });

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');

    expect(await response.json()).toEqual({
      status: 'error',
      message: 'Local capture is disabled.',
    });
  }
});