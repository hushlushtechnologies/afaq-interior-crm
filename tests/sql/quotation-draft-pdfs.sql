\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';

create function pg_temp.expect_pdf_error(a uuid,op text,p jsonb,expected text)
returns void language plpgsql as $$
begin
  begin
    perform public.crm_draft_pdf_gateway(a,op,p);
  exception when others then
    if sqlstate=expected then return; end if;
    raise;
  end;
  raise exception 'Expected PDF rejection: %',expected;
end;
$$;
create temporary table pdf_security_fixture(actor uuid,document_id uuid);
grant select on pdf_security_fixture to authenticated;

do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); lead_uuid uuid:=gen_random_uuid();
  q uuid; p jsonb; r jsonb; retry jsonb; ref jsonb; failed_ref jsonb; doc uuid; i integer;
begin
  insert into auth.users(id,email,email_confirmed_at)
    values(a,'draft-pdf-'||a||'@example.test',now()),(b,'draft-pdf-'||b||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values(a,'sales_executive'),(b,'sales_executive');
  insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by)
    values(lead_uuid,'Synthetic PDF security fixture','manual',a,a);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  q:=(public.crm_save_quotation_draft(jsonb_build_object(
    'requestId',gen_random_uuid(),'quotationId',null,'expectedVersion',null,'leadId',lead_uuid,
    'title','Synthetic draft','quotationDate','2026-11-16','validUntil',null,'companyVatNumber',null,
    'clientNotes',null,'internalNotes','PRIVATE_SENTINEL','terms',null,'paymentTerms',null,
    'sections','[]'::jsonb,'pricing','{"policyId":"s18-exclusive-discount-before-tax-half-up-v1","currency":"AED","items":[],"overallDiscount":{"mode":"none"}}'::jsonb
  ))->>'id')::uuid;
  p:=jsonb_build_object('quotationId',q,'version',1,'requestId',gen_random_uuid(),
    'template','s19-english-a4-v1','sha256',repeat('a',64),'bytes',123,'pages',1);

  perform pg_temp.expect_pdf_error(a,'reserve',p,'42501');
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform pg_temp.expect_pdf_error(b,'reserve',p,'42501');
  perform pg_temp.expect_pdf_error(a,'reserve',p||'{"unexpected":1}'::jsonb,'22023');
  perform pg_temp.expect_pdf_error(a,'reserve',p||'{"bytes":10485761}'::jsonb,'22023');
  perform pg_temp.expect_pdf_error(a,'reserve',p||'{"pages":81}'::jsonb,'22023');
  perform pg_temp.expect_pdf_error(a,'reserve',p||'{"version":99}'::jsonb,'42501');
  perform pg_temp.expect_pdf_error(a,'reserve',p||'{"template":"approved"}'::jsonb,'22023');
  perform pg_temp.expect_pdf_error(a,'reserve',p||'{"sha256":"../evil"}'::jsonb,'22023');
  perform pg_temp.expect_pdf_error(a,'remove',p,'22023');

  r:=public.crm_draft_pdf_gateway(a,'reserve',p);
  doc:=(r->>'id')::uuid;
  ref:=jsonb_build_object('documentId',doc);
  if r->>'state'<>'pending' or r->>'path' !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.pdf$' then
    raise exception 'Unexpected reservation';
  end if;
  retry:=public.crm_draft_pdf_gateway(a,'reserve',p);
  if retry<>r then raise exception 'Retry created another PDF'; end if;
  perform pg_temp.expect_pdf_error(a,'reserve',p||jsonb_build_object('sha256',repeat('b',64)),'22023');
  perform pg_temp.expect_pdf_error(a,'authorize_download',ref,'42501');
  perform pg_temp.expect_pdf_error(a,'finish',ref,'22023');

  -- Metadata-only synthetic Storage object; no bytes or real file are uploaded.
  insert into storage.objects(bucket_id,name,metadata)
    values('crm-quotation-drafts',r->>'path','{"mimetype":"application/pdf","size":122}');
  perform pg_temp.expect_pdf_error(a,'finish',ref,'22023');
  update storage.objects set metadata='{"mimetype":"application/pdf","size":123}'
    where bucket_id='crm-quotation-drafts' and name=r->>'path';
  r:=public.crm_draft_pdf_gateway(a,'finish',ref);
  if r->>'state'<>'ready' then raise exception 'PDF not finalized'; end if;
  perform public.crm_draft_pdf_gateway(a,'finish',ref);
  if (select count(*) from crm_quotes.draft_pdf_events where document_id=doc and action='generated')<>1 then
    raise exception 'Duplicate generation audit';
  end if;
  perform public.crm_draft_pdf_gateway(a,'abandon',ref);
  if (select state from crm_quotes.draft_pdfs where id=doc)<>'ready' then
    raise exception 'Cleanup destroyed a completed retry';
  end if;
  perform pg_temp.expect_pdf_error(b,'authorize_download',ref,'42501');
  perform pg_temp.expect_pdf_error(b,'abandon',ref,'42501');
  perform public.crm_draft_pdf_gateway(a,'authorize_download',ref);
  perform public.crm_draft_pdf_gateway(a,'download_issued',ref);
  if (select count(*) from crm_quotes.draft_pdf_events where document_id=doc and action='download_access_issued')<>1 then
    raise exception 'Missing issuance audit';
  end if;

  update auth.users set banned_until=now()+interval '1 day' where id=a;
  perform pg_temp.expect_pdf_error(a,'authorize_download',ref,'42501');
  perform pg_temp.expect_pdf_error(a,'download_issued',ref,'42501');
  update auth.users set banned_until=null where id=a;
  delete from crm_access.user_roles where user_id=a;
  perform pg_temp.expect_pdf_error(a,'authorize_download',ref,'42501');
  insert into crm_access.user_roles(user_id,role_key) values(a,'sales_executive');

  r:=public.crm_draft_pdf_gateway(a,'reserve',p||jsonb_build_object('requestId',gen_random_uuid()));
  failed_ref:=jsonb_build_object('documentId',r->>'id');
  perform public.crm_draft_pdf_gateway(a,'abandon',failed_ref);
  perform public.crm_draft_pdf_gateway(a,'abandon',failed_ref);
  perform pg_temp.expect_pdf_error(a,'finish',failed_ref,'42501');
  perform pg_temp.expect_pdf_error(a,'authorize_download',failed_ref,'42501');
  if (select count(*) from crm_quotes.draft_pdf_events where document_id=(r->>'id')::uuid and action='failed')<>1 then
    raise exception 'Duplicate cleanup audit';
  end if;
  for i in 1..3 loop
    perform public.crm_draft_pdf_gateway(a,'reserve',p||jsonb_build_object('requestId',gen_random_uuid()));
  end loop;
  perform pg_temp.expect_pdf_error(a,'reserve',p||jsonb_build_object('requestId',gen_random_uuid()),'54000');
  perform public.crm_draft_pdf_gateway(a,'reserve',p);
  begin
    update crm_quotes.draft_pdf_events set action='failed' where document_id=doc;
    raise exception 'Audit update was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from crm_quotes.draft_pdf_events where document_id=doc;
    raise exception 'Audit deletion was allowed';
  exception when insufficient_privilege then null;
  end;
  if has_function_privilege('authenticated','public.crm_draft_pdf_gateway(uuid,text,jsonb)','execute')
    or has_function_privilege('anon','public.crm_draft_pdf_gateway(uuid,text,jsonb)','execute')
    or not has_function_privilege('service_role','public.crm_draft_pdf_gateway(uuid,text,jsonb)','execute') then
    raise exception 'Unexpected gateway grants';
  end if;
  if exists(select 1 from storage.buckets where id='crm-quotation-drafts'
    and (public or file_size_limit<>10485760 or allowed_mime_types<>array['application/pdf'])) then
    raise exception 'Incorrect bucket settings';
  end if;
  insert into pdf_security_fixture values(a,doc);
end;
$$;

-- Deliberately grant broad access inside this rollback-only test. RLS guards
-- must still block direct metadata and Storage reads/writes by employees.
grant usage on schema crm_quotes to authenticated;
grant select on crm_quotes.draft_pdfs,crm_quotes.draft_pdf_events to authenticated;
create policy pdf_test_broad_objects on storage.objects for all to authenticated using(true) with check(true);
create policy pdf_test_broad_buckets on storage.buckets for all to authenticated using(true) with check(true);
select set_config('request.jwt.claims',jsonb_build_object('sub',(select actor from pdf_security_fixture),'role','authenticated')::text,true) is not null;
set local role authenticated;
do $$
begin
  if exists(select 1 from crm_quotes.draft_pdfs) or exists(select 1 from crm_quotes.draft_pdf_events)
    or exists(select 1 from storage.objects where bucket_id='crm-quotation-drafts')
    or exists(select 1 from storage.buckets where id='crm-quotation-drafts') then
    raise exception 'Direct PDF records escaped RLS';
  end if;
  begin
    insert into storage.objects(bucket_id,name) values('crm-quotation-drafts','forbidden.pdf');
    raise exception 'Direct Storage upload allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.crm_draft_pdf_gateway((select actor from pdf_security_fixture),
      'authorize_download',jsonb_build_object('documentId',(select document_id from pdf_security_fixture)));
    raise exception 'Direct employee gateway invocation allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select 'quotation draft PDF security checks passed';
rollback;