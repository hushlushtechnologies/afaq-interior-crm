\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
create function pg_temp.expect_concept_error(p jsonb,expected text)
returns void language plpgsql as $$
begin
  begin perform public.crm_save_quotation_concept(p);
  exception when others then
    if sqlstate=expected then return; end if;
    raise;
  end;
  raise exception 'Expected concept rejection: %',expected;
end;
$$;
create temporary table concept_test_output(value jsonb);

do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); l2 uuid:=gen_random_uuid();
  image uuid:=gen_random_uuid(); foreign_image uuid:=gen_random_uuid(); pdf uuid:=gen_random_uuid();
  room_uuid uuid:=gen_random_uuid(); q uuid; p jsonb; r jsonb; concept_uuid uuid; selected_command jsonb;
  active_page jsonb; archived_page jsonb; retry jsonb; i integer; extra_image uuid; page_result jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (a,'concept-'||a||'@example.test',now()),(b,'concept-'||b||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values(a,'sales_executive'),(b,'sales_executive');
  insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by) values
    (l,'Synthetic concept fixture','manual',a,a),(l2,'Other synthetic lead','manual',b,b);
  insert into crm_sales.attachments(id,lead_id,actor_id,request_id,filename,mime,bytes,sha256,storage_path,state) values
    (image,l,a,gen_random_uuid(),'fixture.png','image/png',100,repeat('a',64),image::text||'/fixture.png','ready'),
    (foreign_image,l2,b,gen_random_uuid(),'other.png','image/png',100,repeat('b',64),foreign_image::text||'/other.png','ready'),
    (pdf,l,a,gen_random_uuid(),'fixture.pdf','application/pdf',100,repeat('c',64),pdf::text||'/fixture.pdf','ready');
  insert into crm_sales.detail_records(lead_id,id,kind,data,created_by,updated_by) values
    (l,room_uuid,'room','{"name":"Living room","room_type":null,"sort_order":0,"requirements_notes":null,"measurement_notes":null,"deliverables_notes":null}',a,a);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  q:=(public.crm_save_quotation_draft(jsonb_build_object(
    'requestId',gen_random_uuid(),'quotationId',null,'expectedVersion',null,'leadId',l,
    'title','Synthetic concept quotation','quotationDate','2026-11-16','validUntil',null,
    'companyVatNumber',null,'clientNotes',null,'internalNotes',null,'terms',null,'paymentTerms',null,
    'sections','[]'::jsonb,'pricing','{"policyId":"s18-exclusive-discount-before-tax-half-up-v1","currency":"AED","items":[],"overallDiscount":{"mode":"none"}}'::jsonb
  ))->>'id')::uuid;
  p:=jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,'revision',1,'command','register',
    'data',jsonb_build_object('attachmentId',image,'roomId',room_uuid,'title','Synthetic reference','promptNotes','Internal prompt notes; not sent.'));
  perform pg_temp.expect_concept_error(p||jsonb_build_object('data',(p->'data')||jsonb_build_object('attachmentId',foreign_image)),'22023');
  perform pg_temp.expect_concept_error(p||jsonb_build_object('data',(p->'data')||jsonb_build_object('attachmentId',pdf)),'22023');
  perform pg_temp.expect_concept_error(p||jsonb_build_object('data',(p->'data')||jsonb_build_object('roomId',gen_random_uuid())),'22023');
  perform pg_temp.expect_concept_error(p||'{"command":"generate"}'::jsonb,'22023');
  perform pg_temp.expect_concept_error(p||jsonb_build_object('data',(p->'data')||'{"origin":"ai_generated"}'::jsonb),'22023');
  r:=public.crm_save_quotation_concept(p); concept_uuid:=(r->>'id')::uuid;
  retry:=public.crm_save_quotation_concept(p);
  if retry->>'id'<>r->>'id' or retry->>'replayed'<>'true'
    or (select count(*) from crm_quotes.concept_events where reference_id=concept_uuid)<>1 then
    raise exception 'Idempotent concept registration failed';
  end if;
  perform pg_temp.expect_concept_error(p||jsonb_build_object('data',(p->'data')||'{"title":"Changed retry"}'::jsonb),'22023');
  perform pg_temp.expect_concept_error(p||jsonb_build_object('requestId',gen_random_uuid()),'23505');
  selected_command:=jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,'revision',1,
    'command','select','data',jsonb_build_object('id',concept_uuid,'version',1,'selected',true));
  r:=public.crm_save_quotation_concept(selected_command);
  if r->>'version'<>'2' or r->>'selected'<>'true' then raise exception 'Selection failed'; end if;
  perform public.crm_save_quotation_concept(selected_command);
  perform pg_temp.expect_concept_error(selected_command||jsonb_build_object('requestId',gen_random_uuid()),'40001');
  update crm_sales.detail_records set archived_at=now() where lead_id=l and id=room_uuid;
  if public.crm_quotation_concepts(q,1,0,false)->'rows'->0->>'available'<>'false' then
    raise exception 'Archived room was not flagged'; end if;
  perform pg_temp.expect_concept_error(selected_command||jsonb_build_object('requestId',gen_random_uuid(),
    'data',jsonb_build_object('id',concept_uuid,'version',2,'selected',true)),'22023');
  update crm_sales.detail_records set archived_at=null where lead_id=l and id=room_uuid;
  update crm_sales.attachments set state='removed',removed_by=a,removed_at=now() where attachments.id=image;
  perform pg_temp.expect_concept_error(selected_command||jsonb_build_object('requestId',gen_random_uuid(),
    'data',jsonb_build_object('id',concept_uuid,'version',2,'selected',true)),'22023');
  perform public.crm_save_quotation_concept(selected_command||jsonb_build_object('requestId',gen_random_uuid(),
    'data',jsonb_build_object('id',concept_uuid,'version',2,'selected',false)));
  active_page:=public.crm_quotation_concepts(q,1,0,false);
  if active_page->>'total'<>'1' or active_page->'rows'->0->>'available'<>'false'
    or active_page->'generation'->>'enabled'<>'false' or active_page::text like '%storage_path%' then
    raise exception 'Unexpected reference projection';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  perform pg_temp.expect_concept_error(p,'42501');
  begin perform public.crm_quotation_concepts(q,1,0,false); raise exception 'Cross-owner read allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  update auth.users set banned_until=now()+interval '1 day' where users.id=a;
  perform pg_temp.expect_concept_error(p,'42501');
  update auth.users set banned_until=null where users.id=a;
  r:=public.crm_save_quotation_concept(jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,
    'revision',1,'command','archive','data',jsonb_build_object('id',concept_uuid,'version',3)));
  if r->>'version'<>'4' or r->>'archived'<>'true' then raise exception 'Archive failed'; end if;
  archived_page:=public.crm_quotation_concepts(q,1,0,true);
  if (public.crm_quotation_concepts(q,1,0,false)->>'total')<>'0'
    or archived_page->>'total'<>'1' or (select count(*) from crm_quotes.concept_events where reference_id=concept_uuid)<>4 then
    raise exception 'Archive/history preservation failed';
  end if;
  begin update crm_quotes.concept_events set action='registered' where reference_id=concept_uuid;
    raise exception 'Audit overwrite permitted'; exception when insufficient_privilege then null; end;
  perform public.crm_create_quotation_revision(jsonb_build_object('requestId',gen_random_uuid(),
    'quotationId',q,'expectedVersion',1,'expectedRevision',1,'reason','Synthetic revision'));
  perform pg_temp.expect_concept_error(p,'42501');
  if public.crm_quotation_concepts(q,1,0,true)->>'canEdit'<>'false' then
    raise exception 'Historical concept remained writable'; end if;
  for i in 1..21 loop
    extra_image:=gen_random_uuid();
    insert into crm_sales.attachments(id,lead_id,actor_id,request_id,filename,mime,bytes,sha256,storage_path,state)
      values(extra_image,l,a,gen_random_uuid(),'page-fixture.png','image/png',100,repeat('d',64),extra_image::text||'/page.png','ready');
    perform public.crm_save_quotation_concept(jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,
      'revision',2,'command','register','data',jsonb_build_object('attachmentId',extra_image,'roomId',null,
        'title','Pagination fixture '||i,'promptNotes',null)));
  end loop;
  page_result:=public.crm_quotation_concepts(q,2,0,false);
  if page_result->>'total'<>'21' or jsonb_array_length(page_result->'rows')<>20
    or jsonb_array_length(public.crm_quotation_concepts(q,2,1,false)->'rows')<>1 then
    raise exception 'Concept pagination failed'; end if;
  begin perform public.crm_quotation_concepts(q,99,0,false); raise exception 'Missing revision accepted';
  exception when invalid_parameter_value then null; end;
  if has_function_privilege('anon','public.crm_save_quotation_concept(jsonb)','execute')
    or has_function_privilege('service_role','public.crm_save_quotation_concept(jsonb)','execute') then
    raise exception 'Unexpected privileged/public grants'; end if;
  insert into concept_test_output values(jsonb_build_object('active',active_page,'archived',archived_page,'saved',r));
end;
$$;

-- RLS stays deny-by-default even after an accidental table read grant.
grant usage on schema crm_quotes to authenticated;
grant select on crm_quotes.concept_references,crm_quotes.concept_events,crm_quotes.concept_requests to authenticated;
set local role authenticated;
do $$ begin
  if exists(select 1 from crm_quotes.concept_references) or exists(select 1 from crm_quotes.concept_events)
    or exists(select 1 from crm_quotes.concept_requests) then raise exception 'Concept records escaped RLS'; end if;
end; $$;
reset role;
select value from concept_test_output;
rollback;