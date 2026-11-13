-- Dedicated local synthetic fixtures. Every write and fault injection rolls back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';
do $$
<<lead_imports>>
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); m uuid:=gen_random_uuid();
 payload jsonb; data jsonb; result jsonb; page jsonb; request_id uuid:=gen_random_uuid();
 confirm_id uuid:=gen_random_uuid(); batch_id uuid; imported uuid; baseline bigint;
 denied boolean; input2 jsonb; batch2 uuid; i integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (a,'s17-'||a||'@example.test',now()),(b,'s17-'||b||'@example.test',now()),(m,'s17-'||m||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values
 (a,'super_admin'),(b,'sales_executive'),(m,'management_director');
 insert into crm_sales.sources(code,name) values('s17_sql','Synthetic import source');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 data:=jsonb_build_object('customer_name','Import fixture','email',null,'phone',null,'alternate_phone',null,
 'source_code','s17_sql','assigned_user_id',a,'priority','normal','property_type',null,'location',null,
 'budget',null,'expected_start_on',null,'inquiry_on','2026-11-12','follow_up_on',null,'description',null,'initial_note',null);
 perform public.crm_save_lead(gen_random_uuid(),'create',null,null,data||'{"email":"existing-import@example.test"}');
 payload:=jsonb_build_object('filename','fixture.csv','fileHash',repeat('a',64),'sourceCode','s17_sql',
 'assignedUserId',a,'defaultInquiryOn','2026-11-12','mapping','{"customer_name":0,"email":1}'::jsonb,'columnCount',2,
 'rows',jsonb_build_array(
 jsonb_build_object('rowNumber',2,'data',data||'{"email":"existing-import@example.test"}','errors','[]'::jsonb),
 jsonb_build_object('rowNumber',3,'data',data||'{"email":"new-import@example.test"}','errors','[]'::jsonb),
 jsonb_build_object('rowNumber',4,'data',null,'errors','["customer_name"]'::jsonb),
 jsonb_build_object('rowNumber',5,'data',data||'{"email":"same-import@example.test"}','errors','[]'::jsonb),
 jsonb_build_object('rowNumber',6,'data',data||'{"email":"SAME-import@example.test"}','errors','[]'::jsonb)));
 baseline:=(select count(*) from crm_sales.leads);
 result:=public.crm_stage_lead_import(request_id,payload); batch_id:=(result->'batch'->>'id')::uuid;
 if result->'batch'->'counts'<>'{"total":5,"ready":1,"invalid":1,"review":3,"applied":0,"skipped":0}'::jsonb
 or (select count(*) from crm_sales.leads)<>baseline then raise exception 'Staging wrote leads or miscounted rows'; end if;
 result:=public.crm_stage_lead_import(request_id,payload);
 if result->>'replayed'<>'true' then raise exception 'Exact retry not replayed'; end if;
 result:=public.crm_stage_lead_import(gen_random_uuid(),payload);
 if result->'batch'->>'id'<>batch_id::text or result->>'replayed'<>'true'
 or (select count(*) from crm_sales.import_events where crm_sales.import_events.batch_id=lead_imports.batch_id)<>1 then
  raise exception 'Same payload created another batch or history event'; end if;
 denied:=false; begin perform public.crm_stage_lead_import(request_id,payload||'{"filename":"changed.csv"}');
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Request ID collision accepted'; end if;
 denied:=false; begin perform public.crm_confirm_lead_import(confirm_id,batch_id,1,'{}');
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Unreviewed invalid/duplicate rows confirmed'; end if;
 result:=public.crm_confirm_lead_import(confirm_id,batch_id,1,array[6,4,2,5]);
 if result->>'applied'<>'1' or result->>'skipped'<>'4' or result->'batch'->>'status'<>'completed'
 or (select count(*) from crm_sales.leads)<>baseline+1 then raise exception 'Confirmation counts incorrect'; end if;
 select resulting_lead_id into imported from crm_sales.import_rows r where r.batch_id=lead_imports.batch_id and row_number=3;
 if (select stage from crm_sales.leads where id=imported)<>'new'
 or (select created_by from crm_sales.leads where id=imported)<>a then raise exception 'Creation provenance or stage forged'; end if;
 result:=public.crm_confirm_lead_import(confirm_id,batch_id,1,array[2,4,5,6]);
 if result->>'replayed'<>'true' or (select count(*) from crm_sales.leads)<>baseline+1
 or (select count(*) from crm_sales.events where lead_id=imported)<>1 then raise exception 'Confirmation replay duplicated effects'; end if;
 denied:=false; begin perform public.crm_confirm_lead_import(confirm_id,batch_id,1,array[2,4]);
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Changed skip selection reused receipt'; end if;
 denied:=false; begin perform public.crm_confirm_lead_import(gen_random_uuid(),batch_id,2,array[2,4,5,6]);
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Completed batch imported again'; end if;
 -- An unexpected late failure rolls back all new staging records.
 baseline:=(select count(*) from crm_sales.import_batches);
 input2:=jsonb_set(payload,'{rows,4,data,stage}','"won"');
 denied:=false; begin perform public.crm_stage_lead_import(gen_random_uuid(),input2);
 exception when invalid_parameter_value then denied:=true; end;
 if not denied or (select count(*) from crm_sales.import_batches)<>baseline then raise exception 'Invalid row escaped atomic staging'; end if;
 -- A new visible duplicate after staging returns to review without creating leads.
 input2:=jsonb_set(payload,'{rows}',jsonb_build_array(jsonb_build_object('rowNumber',2,
 'data',data||'{"email":"late-import@example.test"}','errors','[]'::jsonb)));
 result:=public.crm_stage_lead_import(gen_random_uuid(),input2); batch2:=(result->'batch'->>'id')::uuid;
 perform public.crm_save_lead(gen_random_uuid(),'create',null,null,data||'{"email":"late-import@example.test"}');
 baseline:=(select count(*) from crm_sales.leads); confirm_id:=gen_random_uuid();
 result:=public.crm_confirm_lead_import(confirm_id,batch2,1,'{}');
 if result->>'requiresReview'<>'true' or result->'batch'->>'version'<>'2'
 or (select count(*) from crm_sales.leads)<>baseline then raise exception 'Late duplicate partially imported'; end if;
 if (public.crm_confirm_lead_import(confirm_id,batch2,1,'{}')->>'replayed')<>'true' then raise exception 'Review response not replayed'; end if;
 denied:=false; begin perform public.crm_confirm_lead_import(gen_random_uuid(),batch2,1,array[2]);
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Stale batch version accepted'; end if;
 result:=public.crm_confirm_lead_import(gen_random_uuid(),batch2,2,array[2]);
 if result->>'applied'<>'0' or result->>'skipped'<>'1' then raise exception 'Explicit skip failed'; end if;
 -- Force an audit failure on the second row after the first lead was inserted.
 input2:=jsonb_set(payload,'{rows}',jsonb_build_array(
 jsonb_build_object('rowNumber',2,'data',data||'{"customer_name":"First import fault"}','errors','[]'::jsonb),
 jsonb_build_object('rowNumber',3,'data',data||'{"customer_name":"Second import fault"}','errors','[]'::jsonb)));
 result:=public.crm_stage_lead_import(gen_random_uuid(),input2); batch2:=(result->'batch'->>'id')::uuid;
 alter table crm_sales.events add constraint s17_fault check(action<>'created' or after_data->>'customer_name'<>'Second import fault') not valid;
 baseline:=(select count(*) from crm_sales.leads); confirm_id:=gen_random_uuid(); denied:=false;
 begin perform public.crm_confirm_lead_import(confirm_id,batch2,1,'{}'); exception when check_violation then denied:=true; end;
 if not denied or (select count(*) from crm_sales.leads)<>baseline
 or exists(select 1 from crm_sales.import_requests q where q.request_id=confirm_id)
 or exists(select 1 from crm_sales.import_rows r where r.batch_id=batch2 and status<>'ready') then
  raise exception 'Import failure escaped transaction rollback'; end if;
 alter table crm_sales.events drop constraint s17_fault;
 -- Pagination retains every row. No customer names are used for matching.
 input2:=jsonb_set(payload,'{rows}',(select jsonb_agg(jsonb_build_object('rowNumber',n,'data',data,'errors','[]'::jsonb)) from generate_series(2,22)n));
 result:=public.crm_stage_lead_import(gen_random_uuid(),input2); batch2:=(result->'batch'->>'id')::uuid;
 page:=public.crm_lead_import_page(batch2,1);
 if jsonb_array_length(page->'rows')<>1 or page->'batch'->'counts'->>'ready'<>'21' then raise exception 'Pagination or name matching incorrect'; end if;
 -- Other employee and read-only manager cannot access the batch or its receipt.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 denied:=false; begin perform public.crm_lead_import_page(batch_id,0); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Other employee read the batch'; end if;
 execute 'set local role authenticated';
 if exists(select 1 from crm_sales.import_batches) or exists(select 1 from crm_sales.import_rows)
 or exists(select 1 from crm_sales.import_events) then raise exception 'RLS exposed another importer records'; end if;
 denied:=false; begin delete from crm_sales.import_rows; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct row mutation allowed'; end if;
 execute 'reset role';
 -- Visibility-scoped duplicate checks do not expose the admin-only customer.
 input2:=jsonb_set(jsonb_set(payload,'{assignedUserId}',to_jsonb(b)),'{rows}',jsonb_build_array(jsonb_build_object(
 'rowNumber',2,'data',data||jsonb_build_object('assigned_user_id',b,'email','existing-import@example.test'),'errors','[]'::jsonb)));
 result:=public.crm_stage_lead_import(gen_random_uuid(),input2);
 if result->'batch'->'counts'->>'ready'<>'1' then raise exception 'Inaccessible match disclosed'; end if;
 -- Bound staging volume while exact retries remain usable.
 for i in 1..4 loop
  perform public.crm_stage_lead_import(gen_random_uuid(),jsonb_set(input2,'{fileHash}',to_jsonb(repeat('b',63)||i::text)));
 end loop;
 denied:=false;
 begin perform public.crm_stage_lead_import(gen_random_uuid(),jsonb_set(input2,'{fileHash}',to_jsonb(repeat('c',64))));
 exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Staging quota was not enforced'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.crm_change_employee_status(gen_random_uuid(),b,'active','inactive');
 denied:=false;
 begin perform public.crm_stage_lead_import(gen_random_uuid(),jsonb_set(input2,'{fileHash}',to_jsonb(repeat('d',64))));
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Inactive assignee accepted'; end if;
 perform public.crm_change_employee_status(gen_random_uuid(),b,'inactive','active');
 update crm_sales.sources set active=false where code='s17_sql';
 denied:=false;
 begin perform public.crm_stage_lead_import(gen_random_uuid(),jsonb_set(input2,'{fileHash}',to_jsonb(repeat('e',64))));
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Inactive source accepted'; end if;
 update crm_sales.sources set active=true where code='s17_sql';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',m,'role','authenticated')::text,true);
 denied:=false; begin perform public.crm_stage_lead_import(gen_random_uuid(),payload); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Read-only manager staged import'; end if;
 if has_function_privilege('anon','public.crm_confirm_lead_import(uuid,uuid,integer,integer[])','execute')
 or has_function_privilege('authenticated','crm_sales.check_import_fields(jsonb)','execute') then
  raise exception 'Private or anonymous execution grant exposed'; end if;
end;
$$;
rollback;