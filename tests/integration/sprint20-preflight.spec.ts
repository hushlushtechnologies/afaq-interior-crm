import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('documents the current PM assignment gap without changing permissions', () => {
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
  const sql = `begin;
    set local statement_timeout='30s';
    create temporary table sprint20_probe(value jsonb);
    do $$
    declare sales uuid:=gen_random_uuid(); pm uuid:=gen_random_uuid();
      lead_uuid uuid:=gen_random_uuid(); quote_uuid uuid; rejected boolean:=false;
    begin
      insert into auth.users(id,email,email_confirmed_at) values
        (sales,'s20-sales-'||sales||'@example.test',now()),
        (pm,'s20-pm-'||pm||'@example.test',now());
      insert into crm_access.user_roles(user_id,role_key)
        values(sales,'sales_executive'),(pm,'project_manager');
      insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by)
        values(lead_uuid,'Synthetic Sprint 20 preflight','manual',sales,sales);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',sales,'role','authenticated')::text,true);
      quote_uuid:=(public.crm_save_quotation_draft(jsonb_build_object(
        'requestId',gen_random_uuid(),'quotationId',null,'expectedVersion',null,'leadId',lead_uuid,
        'title','Synthetic review scope','quotationDate','2026-11-17','validUntil',null,
        'companyVatNumber',null,'clientNotes',null,'internalNotes',null,'terms',null,
        'paymentTerms',null,'sections','[]'::jsonb,
        'pricing','{"policyId":"s18-exclusive-discount-before-tax-half-up-v1","currency":"AED","items":[],"overallDiscount":{"mode":"none"}}'::jsonb
      ))->>'id')::uuid;
      perform set_config('request.jwt.claims',jsonb_build_object('sub',pm,'role','authenticated')::text,true);
      begin
        perform public.crm_get_quotation(quote_uuid);
      exception when insufficient_privilege then rejected:=true;
      end;
      insert into sprint20_probe values(jsonb_build_object(
        'eligiblePm',crm_access.is_eligible_user(pm),
        'hasAssignedApprovalPermission',public.crm_has_permission('quotations.approve','assigned'),
        'eligibleSalesOwner',crm_sales.eligible_owner(pm),
        'canViewQuotation',public.crm_can_view_quotation(quote_uuid),
        'readRejected',rejected));
    end; $$;
    select value from sprint20_probe;
    rollback;`;
  const output = docker(
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
    sql,
  );
  expect(JSON.parse(output)).toEqual({
    eligiblePm: true,
    hasAssignedApprovalPermission: true,
    eligibleSalesOwner: false,
    canViewQuotation: false,
    readRejected: true,
  });
});