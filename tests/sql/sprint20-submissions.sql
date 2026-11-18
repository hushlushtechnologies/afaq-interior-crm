\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
create function pg_temp.expect_review_error(statement text,expected text)
returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate=expected then return; end if; raise;
  end;
  raise exception 'Expected review rejection: %',expected;
end;
$$;
create temporary table review_test_output(value jsonb);
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
  l uuid:=gen_random_uuid(); image uuid:=gen_random_uuid(); room_uuid uuid:=gen_random_uuid();
  q uuid; empty_q uuid; concept_uuid uuid; p jsonb; command jsonb; saved jsonb; review_uuid uuid; body jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (a,'s20-a-'||a||'@example.test',now()),(b,'s20-b-'||b||'@example.test',now()),
    (c,'s20-c-'||c||'@example.test',now()),(f,'s20-f-'||f||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values(a,'sales_executive'),
    (b,'project_manager'),(b,'sales_executive'),(c,'project_manager'),(f,'finance_officer');
  insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by)
    values(l,'Synthetic review fixture','manual',a,a);
  insert into crm_sales.attachments(id,lead_id,actor_id,request_id,filename,mime,bytes,sha256,storage_path,state)
    values(image,l,a,gen_random_uuid(),'review.png','image/png',100,repeat('a',64),image::text||'/review.png','ready');
  insert into storage.objects(bucket_id,name,metadata)
    values('crm-private',image::text||'/review.png','{"mimetype":"image/png","size":100}');
  insert into crm_sales.detail_records(lead_id,id,kind,data,created_by,updated_by) values
    (l,room_uuid,'room','{"name":"Frozen review room","room_type":null,"sort_order":0,"requirements_notes":null,"measurement_notes":null,"deliverables_notes":null}',a,a);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  p:=jsonb_build_object('requestId',gen_random_uuid(),'quotationId',null,'expectedVersion',null,'leadId',l,
    'title','Synthetic review quotation','quotationDate','2026-11-17','validUntil',null,
    'companyVatNumber',null,'clientNotes',null,'internalNotes','Internal review notes','terms',null,'paymentTerms',null,
    'sections','[]'::jsonb,'pricing',jsonb_build_object('policyId','s18-exclusive-discount-before-tax-half-up-v1',
      'currency','AED','items',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'sectionId',null,
        'description','Synthetic service','quantity','1','unit','service','unitPrice','100',
        'discount',jsonb_build_object('mode','none'),'tax',jsonb_build_object('treatment','exempt'))),
      'overallDiscount',jsonb_build_object('mode','none')));
  q:=(public.crm_save_quotation_draft(p)->>'id')::uuid;
  empty_q:=(public.crm_save_quotation_draft(p||jsonb_build_object('requestId',gen_random_uuid(),
    'pricing',(p->'pricing')||'{"items":[]}'::jsonb))->>'id')::uuid;
  command:=jsonb_build_object('requestId',gen_random_uuid(),'quotationId',empty_q,'expectedRevision',1,'expectedVersion',1,'reviewerId',c);
  perform pg_temp.expect_review_error(format('select public.crm_submit_quotation_review(%L::jsonb)',command),'22023');
  concept_uuid:=(public.crm_save_quotation_concept(jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,
    'revision',1,'command','register','data',jsonb_build_object('attachmentId',image,'roomId',room_uuid,
      'title','Selected private reference','promptNotes',null)))->>'id')::uuid;
  perform public.crm_save_quotation_concept(jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,'revision',1,
    'command','select','data',jsonb_build_object('id',concept_uuid,'version',1,'selected',true)));
  -- A genuine save by another eligible owner makes that PM the latest editor.
  update crm_sales.leads set assigned_user_id=b where id=l;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  perform public.crm_save_quotation_draft(p||jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,'expectedVersion',1));
  update crm_sales.leads set assigned_user_id=a where id=l;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  command:=jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,'expectedRevision',1,'expectedVersion',2,'reviewerId',b);
  perform pg_temp.expect_review_error(format('select public.crm_submit_quotation_review(%L::jsonb)',command),'42501');
  insert into crm_access.user_roles(user_id,role_key) values(a,'project_manager'),(a,'super_admin');
  perform pg_temp.expect_review_error(format('select public.crm_submit_quotation_review(%L::jsonb)',
    command||jsonb_build_object('reviewerId',a)),'42501');
  command:=command||jsonb_build_object('reviewerId',c);
  update storage.objects set metadata='{"mimetype":"image/png","size":99}'
    where bucket_id='crm-private' and name=image::text||'/review.png';
  perform pg_temp.expect_review_error(format('select public.crm_submit_quotation_review(%L::jsonb)',command),'22023');
  update storage.objects set metadata='{"mimetype":"image/png","size":100}'
    where bucket_id='crm-private' and name=image::text||'/review.png';
  saved:=public.crm_submit_quotation_review(command); review_uuid:=(saved->>'id')::uuid;
  if saved->>'status'<>'pending' or saved->>'savedVersion'<>'2' then raise exception 'Submission failed'; end if;
  if public.crm_submit_quotation_review(command)->>'replayed'<>'true' then raise exception 'Retry did not replay'; end if;
  if (select count(*) from crm_quotes.review_requests where quotation_id=q)<>1 then raise exception 'Duplicate request'; end if;
  perform pg_temp.expect_review_error(format('select public.crm_submit_quotation_review(%L::jsonb)',
    command||jsonb_build_object('reviewerId',b)),'22023');
  perform pg_temp.expect_review_error(format('select public.crm_submit_quotation_review(%L::jsonb)',
    command||jsonb_build_object('requestId',gen_random_uuid())),'40001');
  perform pg_temp.expect_review_error(format('select public.crm_save_quotation_draft(%L::jsonb)',
    p||jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,'expectedVersion',2)),'42501');
  perform pg_temp.expect_review_error(format('select public.crm_create_quotation_revision(%L::jsonb)',
    jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,'expectedVersion',2,'expectedRevision',1,'reason','Blocked pending')),'42501');
  perform pg_temp.expect_review_error(format('select public.crm_save_quotation_concept(%L::jsonb)',
    jsonb_build_object('requestId',gen_random_uuid(),'quotationId',q,'revision',1,'command','archive',
      'data',jsonb_build_object('id',concept_uuid,'version',2))),'42501');
  perform pg_temp.expect_review_error(format('update crm_sales.attachments set state=''removed'',removed_by=%L,removed_at=now() where id=%L',a,image),'42501');
  perform pg_temp.expect_review_error(format('delete from crm_sales.attachments where id=%L',image),'42501');
  perform pg_temp.expect_review_error(format('update crm_quotes.review_requests set snapshot=''{}'' where id=%L',review_uuid),'42501');
  -- Other drafts remain editable and can still create commercial revisions.
  perform public.crm_save_quotation_draft(p||jsonb_build_object('requestId',gen_random_uuid(),'quotationId',empty_q,'expectedVersion',1));
  perform public.crm_create_quotation_revision(jsonb_build_object('requestId',gen_random_uuid(),
    'quotationId',empty_q,'expectedVersion',2,'expectedRevision',1,'reason','Unsubmitted draft remains editable'));
  update crm_sales.detail_records set data=jsonb_set(data,'{name}','"Later room name"') where lead_id=l and id=room_uuid;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
  body:=public.crm_get_quotation_review(review_uuid);
  if body->'evidence'->'requirements'->0->'data'->>'name'<>'Frozen review room'
    or body->'snapshot'->'calculation'->'totals'->>'grandTotal'<>'100.00' then raise exception 'Snapshot changed'; end if;
  perform pg_temp.expect_review_error(format('select public.crm_get_quotation(%L::uuid)',q),'42501');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  perform pg_temp.expect_review_error(format('select public.crm_get_quotation_review(%L::uuid)',review_uuid),'42501');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f,'role','authenticated')::text,true);
  if public.crm_get_quotation_review(review_uuid)->'evidence'<>'null'::jsonb then raise exception 'Finance evidence leaked'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
  update auth.users set banned_until=now()+interval '1 day' where id=c;
  perform pg_temp.expect_review_error(format('select public.crm_get_quotation_review(%L::uuid)',review_uuid),'42501');
  update auth.users set banned_until=null where id=c;
  if (select stage from crm_sales.leads where id=l)<>'new' or (select status from crm_quotes.drafts where quotation_id=q)<>'draft' then
    raise exception 'Submission changed a lead or draft status'; end if;
  if has_function_privilege('anon','public.crm_submit_quotation_review(jsonb)','execute')
    or has_function_privilege('service_role','public.crm_submit_quotation_review(jsonb)','execute') then raise exception 'RPC grants leaked'; end if;
  insert into review_test_output values(jsonb_build_object('saved',saved,'review',body));
end;
$$;
grant usage on schema crm_quotes to authenticated;
grant select on crm_quotes.review_requests,crm_quotes.review_files,crm_quotes.review_receipts to authenticated;
set local role authenticated;
do $$ begin
  if exists(select 1 from crm_quotes.review_requests) or exists(select 1 from crm_quotes.review_files)
    or exists(select 1 from crm_quotes.review_receipts) then raise exception 'Direct review records escaped RLS'; end if;
end; $$;
reset role;
select value from review_test_output;
rollback;