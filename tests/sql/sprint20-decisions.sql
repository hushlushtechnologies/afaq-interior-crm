\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
create function pg_temp.expect_decision_error(statement text,expected text)
returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then if sqlstate=expected then return; end if; raise;
  end;
  raise exception 'Expected decision rejection: %',expected;
end;
$$;
create temporary table decision_test_output(value jsonb);
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); l uuid:=gen_random_uuid();
  image uuid:=gen_random_uuid(); concept_uuid uuid; qids uuid[]:=array[]::uuid[]; rids uuid[]:=array[]::uuid[];
  p jsonb; command jsonb; decision_result jsonb; approved_result jsonb; old_snapshot jsonb; pending_result jsonb;
  qid uuid; rid uuid; i integer; action text;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (a,'s20-da-'||a||'@example.test',now()),(b,'s20-db-'||b||'@example.test',now()),(c,'s20-dc-'||c||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values
    (a,'sales_executive'),(a,'super_admin'),(a,'project_manager'),(b,'project_manager'),(c,'project_manager');
  insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by)
    values(l,'Synthetic decision fixture','manual',a,a);
  insert into crm_sales.attachments(id,lead_id,actor_id,request_id,filename,mime,bytes,sha256,storage_path,state)
    values(image,l,a,gen_random_uuid(),'decision.png','image/png',100,repeat('a',64),image::text||'/decision.png','ready');
  insert into storage.objects(bucket_id,name,metadata) values('crm-private',image::text||'/decision.png','{"mimetype":"image/png","size":100}');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  for i in 1..4 loop
    p:=jsonb_build_object('requestId',gen_random_uuid(),'quotationId',null,'expectedVersion',null,'leadId',l,
      'title','Synthetic decision quotation '||i,'quotationDate','2000-01-01',
      'validUntil',case when i=4 then to_jsonb(((now() at time zone 'Asia/Dubai')::date-1)::text) else 'null'::jsonb end,
      'companyVatNumber',null,'clientNotes',null,'internalNotes',null,'terms',null,'paymentTerms',null,'sections','[]'::jsonb,
      'pricing',jsonb_build_object('policyId','s18-exclusive-discount-before-tax-half-up-v1','currency','AED',
        'items',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'sectionId',null,'description','Synthetic service',
          'quantity','1','unit','service','unitPrice','100','discount',jsonb_build_object('mode','none'),
          'tax',jsonb_build_object('treatment','exempt'))),'overallDiscount',jsonb_build_object('mode','none')));
    qid:=(public.crm_save_quotation_draft(p)->>'id')::uuid; qids:=array_append(qids,qid);
    if i=1 then
      concept_uuid:=(public.crm_save_quotation_concept(jsonb_build_object('requestId',gen_random_uuid(),'quotationId',qid,
        'revision',1,'command','register','data',jsonb_build_object('attachmentId',image,'roomId',null,
          'title','Frozen decision image','promptNotes',null)))->>'id')::uuid;
      perform public.crm_save_quotation_concept(jsonb_build_object('requestId',gen_random_uuid(),'quotationId',qid,'revision',1,
        'command','select','data',jsonb_build_object('id',concept_uuid,'version',1,'selected',true)));
    end if;
    rid:=(public.crm_submit_quotation_review(jsonb_build_object('requestId',gen_random_uuid(),'quotationId',qid,
      'expectedRevision',1,'expectedVersion',1,'reviewerId',b))->>'id')::uuid; rids:=array_append(rids,rid);
  end loop;
  command:=jsonb_build_object('requestId',gen_random_uuid(),'reviewId',rids[1],
    'expectedRevision',1,'expectedSavedVersion',1,'decision','approve','comments',null);
  perform pg_temp.expect_decision_error(format('select public.crm_decide_quotation_review(%L::jsonb)',command),'42501');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
  perform pg_temp.expect_decision_error(format('select public.crm_decide_quotation_review(%L::jsonb)',command),'42501');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  perform pg_temp.expect_decision_error(format('select public.crm_decide_quotation_review(%L::jsonb)',
    command||'{"decision":"reject"}'::jsonb),'22023');
  perform pg_temp.expect_decision_error(format('select public.crm_decide_quotation_review(%L::jsonb)',
    command||'{"expectedSavedVersion":99}'::jsonb),'40001');
  update auth.users set banned_until=now()+interval '1 day' where id=b;
  perform pg_temp.expect_decision_error(format('select public.crm_decide_quotation_review(%L::jsonb)',command),'42501');
  update auth.users set banned_until=null where id=b;
  update storage.objects set metadata='{"mimetype":"image/png","size":99}' where bucket_id='crm-private' and name=image::text||'/decision.png';
  perform pg_temp.expect_decision_error(format('select public.crm_decide_quotation_review(%L::jsonb)',command),'22023');
  update storage.objects set metadata='{"mimetype":"image/png","size":100}' where bucket_id='crm-private' and name=image::text||'/decision.png';
  approved_result:=public.crm_decide_quotation_review(command);
  if approved_result->>'status'<>'approved' or public.crm_decide_quotation_review(command)->>'replayed'<>'true' then
    raise exception 'Approval or replay failed'; end if;
  perform pg_temp.expect_decision_error(format('select public.crm_decide_quotation_review(%L::jsonb)',
    command||'{"comments":"Changed retry"}'::jsonb),'22023');
  perform pg_temp.expect_decision_error(format('select public.crm_decide_quotation_review(%L::jsonb)',
    command||jsonb_build_object('requestId',gen_random_uuid(),'decision','reject','comments','Another decision')),'40001');
  perform pg_temp.expect_decision_error(format('update crm_quotes.review_decisions set comments=''overwrite'' where review_id=%L',rids[1]),'42501');
  perform pg_temp.expect_decision_error(format('update crm_quotes.review_requests set status=''pending'' where id=%L',rids[1]),'42501');
  old_snapshot:=public.crm_get_quotation_review(rids[1])->'snapshot';
  for i in 2..4 loop
    action:=case when i=2 then 'reject' else 'request_changes' end;
    command:=jsonb_build_object('requestId',gen_random_uuid(),'reviewId',rids[i],'expectedRevision',1,'expectedSavedVersion',1,
      'decision',action,'comments','Revise the recorded commercial terms.');
    if i=4 then
      perform pg_temp.expect_decision_error(format('select public.crm_decide_quotation_review(%L::jsonb)',
        command||'{"decision":"approve"}'::jsonb),'22023');
    end if;
    decision_result:=public.crm_decide_quotation_review(command);
    if decision_result->>'status'<>(case when i=2 then 'rejected' else 'changes_requested' end) then
      raise exception 'Decision state failed'; end if;
  end loop;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  perform pg_temp.expect_decision_error(format('select public.crm_save_quotation_draft(%L::jsonb)',
    p||jsonb_build_object('requestId',gen_random_uuid(),'quotationId',qids[1],'expectedVersion',1)),'42501');
  for i in 1..4 loop
    perform public.crm_create_quotation_revision(jsonb_build_object('requestId',gen_random_uuid(),
      'quotationId',qids[i],'expectedVersion',1,'expectedRevision',1,'reason','Corrected revision after review'));
    if public.crm_get_quotation_review(rids[i])->>'isCurrentRevision'<>'false' then raise exception 'Old review marked current'; end if;
  end loop;
  perform public.crm_save_quotation_draft(p||jsonb_build_object('requestId',gen_random_uuid(),'quotationId',qids[1],
    'expectedVersion',2,'title','Corrected scope','validUntil',null));
  pending_result:=public.crm_submit_quotation_review(jsonb_build_object('requestId',gen_random_uuid(),'quotationId',qids[1],
    'expectedRevision',2,'expectedVersion',3,'reviewerId',b));
  if public.crm_get_quotation_review((pending_result->>'id')::uuid)->>'status'<>'pending' then
    raise exception 'A corrected revision inherited approval'; end if;
  if public.crm_get_quotation_review(rids[1])->'snapshot'<>old_snapshot
    or (select count(*) from crm_quotes.review_decisions)<>4
    or (select stage from crm_sales.leads where id=l)<>'new' then raise exception 'History or lead stage changed'; end if;
  insert into decision_test_output values(jsonb_build_object('decision',approved_result,
    'review',public.crm_get_quotation_review(rids[1]),'pending',public.crm_get_quotation_review((pending_result->>'id')::uuid)));
end;
$$;
grant usage on schema crm_quotes to authenticated;
grant select on crm_quotes.review_decisions to authenticated;
set local role authenticated;
do $$ begin if exists(select 1 from crm_quotes.review_decisions) then raise exception 'Decision rows escaped RLS'; end if; end; $$;
reset role;
select value from decision_test_output;
rollback;