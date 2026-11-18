import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { createDraftQuotationPdfModel } from '../../src/features/quotations/pdf-model';

test('actual authorized SQL snapshots project an earlier saved revision without leaking internal notes', () => {
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

  const identity = execFileSync(
    'docker',
    [
      `--host=${host}`,
      'inspect',
      '--format',
      '{{.Name}}|{{.State.Running}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
      container,
    ],
    { env, encoding: 'utf8' },
  ).trim();

  expect(identity).toBe(`/${container}|true|57422`);

  const sql = `begin;
    set local statement_timeout='30s';

    do $$
    declare
      a uuid:=gen_random_uuid();
      l uuid:=gen_random_uuid();
      q uuid;
      p jsonb;
    begin
      insert into auth.users(id,email,email_confirmed_at)
      values(a,'pdf-fixture-'||a||'@example.test',now());

      insert into crm_access.user_roles(user_id,role_key)
      values(a,'sales_executive');

      insert into crm_sales.leads(
        id,customer_name,source_code,assigned_user_id,created_by
      )
      values(l,'Synthetic PDF fixture','manual',a,a);

      perform set_config(
        'request.jwt.claims',
        jsonb_build_object('sub',a,'role','authenticated')::text,
        true
      );

      p:=jsonb_build_object(
        'requestId',gen_random_uuid(),
        'quotationId',null,
        'expectedVersion',null,
        'leadId',l,
        'title','Original PDF scope',
        'quotationDate','2026-11-16',
        'validUntil',null,
        'companyVatNumber',null,
        'clientNotes','Client-safe scope',
        'internalNotes','INTERNAL_SQL_PDF_47',
        'terms',null,
        'paymentTerms',null,
        'sections','[]'::jsonb,
        'pricing','{"policyId":"s18-exclusive-discount-before-tax-half-up-v1","currency":"AED","items":[],"overallDiscount":{"mode":"none"}}'::jsonb
      );

      q:=(public.crm_save_quotation_draft(p)->>'id')::uuid;

      perform public.crm_create_quotation_revision(
        jsonb_build_object(
          'requestId',gen_random_uuid(),
          'quotationId',q,
          'expectedVersion',1,
          'expectedRevision',1,
          'reason','New scope'
        )
      );

      perform public.crm_save_quotation_draft(
        p||jsonb_build_object(
          'requestId',gen_random_uuid(),
          'quotationId',q,
          'expectedVersion',2,
          'title','Current edited scope'
        )
      );

      create temporary table pdf_fixture_result(value jsonb);

      insert into pdf_fixture_result
      values(
        jsonb_build_object(
          'record',public.crm_get_quotation(q),
          'snapshot',public.crm_quotation_snapshot(q,1)
        )
      );
    end;
    $$;

    select value from pdf_fixture_result;

    rollback;`;

  const output = execFileSync(
    'docker',
    [
      `--host=${host}`,
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
    {
      env,
      input: sql,
      encoding: 'utf8',
      timeout: 40000,
    },
  );

  const response = JSON.parse(output.trim());

  expect(response.record.revision).toBe(2);
  expect(response.record.version).toBe(3);

  const model = createDraftQuotationPdfModel(response.record, response.snapshot);

  expect(model.quotation.revision).toBe(1);
  expect(model.quotation.savedVersion).toBe(1);
  expect(model.quotation.title).toBe('Original PDF scope');
  expect(model.totals.grandTotal).toBe('0.00');
  expect(JSON.stringify(model)).not.toContain('INTERNAL_SQL_PDF_47');
});