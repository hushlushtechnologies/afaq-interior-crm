-- Dedicated local database only. Synthetic rows and fake object metadata roll back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
do $$
declare
 admin uuid:=gen_random_uuid(); sales uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 lead_uuid uuid; other_uuid uuid; file_uuid uuid; request_uuid uuid:=gen_random_uuid();
 payload jsonb; result jsonb; ref jsonb; denied boolean; i integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (admin,'s15a-'||admin||'@example.test',now()),(sales,'s15a-'||sales||'@example.test',now()),
 (stranger,'s15a-'||stranger||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values(admin,'super_admin'),(sales,'sales_executive'),(stranger,'sales_executive');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 lead_uuid:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,jsonb_build_object(
   'customer_name','Attachment fixture','assigned_user_id',sales,'source_code','manual','priority','normal','inquiry_on','2026-11-07'))->'lead'->>'id')::uuid;
 other_uuid:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,jsonb_build_object(
   'customer_name','Other fixture','assigned_user_id',stranger,'source_code','manual','priority','normal','inquiry_on','2026-11-07'))->'lead'->>'id')::uuid;
 if has_function_privilege('authenticated','public.crm_attachment_gateway(uuid,text,jsonb)','execute')
   or has_function_privilege('anon','public.crm_attachment_gateway(uuid,text,jsonb)','execute')
   or has_table_privilege('authenticated','crm_sales.attachments','insert,update,delete') then
   raise exception 'Client mutation privileges leaked'; end if;
 denied:=false;
 begin perform public.crm_attachment_gateway(sales,'check_upload',jsonb_build_object('leadId',lead_uuid));
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Employee impersonated gateway'; end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 payload:=jsonb_build_object('leadId',lead_uuid,'requestId',request_uuid,'filename','Plan.pdf','mime','application/pdf','bytes',20,'sha256',repeat('a',64));
 result:=public.crm_attachment_gateway(sales,'reserve',payload); file_uuid:=(result->>'id')::uuid;
 ref:=jsonb_build_object('leadId',lead_uuid,'attachmentId',file_uuid);
 if result->>'state'<>'pending' or public.crm_attachment_gateway(sales,'reserve',payload)->>'id'<>file_uuid::text then
   raise exception 'Reservation retry failed'; end if;
 denied:=false;
 begin perform public.crm_attachment_gateway(sales,'reserve',payload||'{"bytes":21}');
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Changed retry accepted'; end if;
 denied:=false;
 begin perform public.crm_attachment_gateway(stranger,'finish',ref);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Cross-owner finish accepted'; end if;
 denied:=false;
 begin perform public.crm_attachment_gateway(sales,'finish',ref);
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Missing object accepted'; end if;
 insert into storage.objects(bucket_id,name,metadata) values('crm-private',result->>'path','{"size":20,"mimetype":"application/pdf"}');
 execute format('alter table crm_sales.attachment_events add constraint s15_attachment_fault check(attachment_id<>%L::uuid) not valid',file_uuid);
 denied:=false;
 begin perform public.crm_attachment_gateway(sales,'finish',ref); exception when check_violation then denied:=true; end;
 if not denied or (select state from crm_sales.attachments where id=file_uuid)<>'pending'
   or exists(select 1 from crm_sales.attachment_events where attachment_id=file_uuid) then
   raise exception 'Audit failure did not roll back finalization'; end if;
 alter table crm_sales.attachment_events drop constraint s15_attachment_fault;
 perform public.crm_attachment_gateway(sales,'finish',ref);
 perform public.crm_attachment_gateway(sales,'finish',ref);
 perform public.crm_attachment_gateway(sales,'abandon',ref);
 if (select state from crm_sales.attachments where id=file_uuid)<>'ready'
   or (select count(*) from crm_sales.attachment_events where attachment_id=file_uuid and action='uploaded')<>1 then
   raise exception 'Finalize retry or abandon damaged committed upload'; end if;
 denied:=false;
 begin perform public.crm_attachment_gateway(sales,'authorize_download',ref||jsonb_build_object('leadId',other_uuid));
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Cross-lead access accepted'; end if;
 perform public.crm_attachment_gateway(sales,'download_issued',ref);
 if not exists(select 1 from crm_sales.attachment_events where attachment_id=file_uuid and action='download_access_issued') then
   raise exception 'Download issuance audit absent'; end if;
 denied:=false;
 begin perform public.crm_attachment_gateway(sales,'remove',ref||jsonb_build_object('requestId',gen_random_uuid(),'version',1));
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Sales bypassed archive permission'; end if;
 denied:=false;
 begin perform public.crm_attachment_gateway(admin,'remove',ref||jsonb_build_object('requestId',gen_random_uuid(),'version',2));
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Stale removal version accepted'; end if;
 perform public.crm_attachment_gateway(admin,'remove',ref||jsonb_build_object('requestId',gen_random_uuid(),'version',1));
 denied:=false;
 begin perform public.crm_attachment_gateway(sales,'authorize_download',ref);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Removed attachment download allowed'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales,'role','authenticated')::text,true);
 if public.crm_lead_attachments(lead_uuid,0,false)->>'total'<>'0'
   or public.crm_lead_attachments(lead_uuid,0,true)->>'total'<>'1' then raise exception 'Active/removed listing failed'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_lead_attachments(lead_uuid); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Unrelated Sales listed attachments'; end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 for i in 1..9 loop
   perform public.crm_attachment_gateway(sales,'reserve',payload||jsonb_build_object('requestId',gen_random_uuid()));
 end loop;
 denied:=false;
 begin perform public.crm_attachment_gateway(sales,'reserve',payload||jsonb_build_object('requestId',gen_random_uuid()));
 exception when program_limit_exceeded then denied:=true; end;
 if not denied then raise exception 'Reservation rate limit absent'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales,'role','authenticated')::text,true);
 set local role authenticated;
 if (select count(id) from crm_sales.attachments where lead_id=lead_uuid)<>1
   or (select count(id) from crm_sales.attachment_events where attachment_id=file_uuid)<>3 then
   raise exception 'RLS visibility or pending upload hiding failed'; end if;
 denied:=false;
 begin perform storage_path from crm_sales.attachments where id=file_uuid;
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Private object paths leaked through direct SELECT'; end if;
 denied:=false;
 begin perform public.crm_attachment_gateway(admin,'authorize_download',ref);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Authenticated role invoked privileged gateway'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
 if exists(select 1 from crm_sales.attachments where lead_id=lead_uuid)
   or exists(select 1 from crm_sales.attachment_events where attachment_id=file_uuid) then
   raise exception 'Cross-lead direct RLS failed'; end if;
 reset role;
 if (select count(*) from pg_policies where schemaname='storage' and policyname in ('crm_private_object_guard','crm_private_bucket_guard') and permissive='RESTRICTIVE')<>2 then
   raise exception 'Private Storage guards changed'; end if;
 raise notice 'Attachment database assertions passed';
end;
$$;
rollback;