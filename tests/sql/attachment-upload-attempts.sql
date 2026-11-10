-- Dedicated local fixtures only; no file uploads. Everything rolls back.
\set ON_ERROR_STOP on
begin;
do $$
declare actor uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); lead_uuid uuid; denied boolean; i integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (actor,'s15t-'||actor||'@example.test',now()),(stranger,'s15t-'||stranger||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values(actor,'sales_executive'),(stranger,'sales_executive');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 lead_uuid:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,jsonb_build_object(
   'customer_name','Throttle fixture','assigned_user_id',actor,'source_code','manual','priority','normal','inquiry_on','2026-11-07'))->'lead'->>'id')::uuid;
 if has_function_privilege('authenticated','public.crm_attachment_upload_attempt(uuid,uuid)','execute')
   or has_table_privilege('authenticated','crm_sales.attachment_upload_windows','select,insert,update,delete') then
   raise exception 'Private throttle privileges leaked'; end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 denied:=false;
 begin perform public.crm_attachment_upload_attempt(stranger,lead_uuid); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Unrelated employee passed upload gate'; end if;
 for i in 1..10 loop perform public.crm_attachment_upload_attempt(actor,lead_uuid); end loop;
 denied:=false;
 begin perform public.crm_attachment_upload_attempt(actor,lead_uuid); exception when program_limit_exceeded then denied:=true; end;
 if not denied then raise exception 'Eleventh attempt was accepted'; end if;
 update crm_sales.attachment_upload_windows set started_at=now()-interval '2 minutes' where actor_id=actor;
 perform public.crm_attachment_upload_attempt(actor,lead_uuid);
 if (select attempts from crm_sales.attachment_upload_windows where actor_id=actor)<>1 then raise exception 'Window reset failed'; end if;
 update auth.users set banned_until=now()+interval '1 hour' where id=actor;
 denied:=false;
 begin perform public.crm_attachment_upload_attempt(actor,lead_uuid); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Inactive account passed upload gate'; end if;
 raise notice 'Upload attempt assertions passed';
end;
$$;
rollback;