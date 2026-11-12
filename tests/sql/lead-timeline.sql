-- Isolated authorization and stable pagination fixtures; all changes roll back.
\set ON_ERROR_STOP on
begin;

do $$
declare
 admin uuid:=gen_random_uuid();
 outsider uuid:=gen_random_uuid();
 lead_uuid uuid;
 result jsonb;
 first_ids text[];
 last_ids text[];
 i integer;
 denied boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (admin,'s16t-'||admin||'@example.test',now()),
 (outsider,'s16t-'||outsider||'@example.test',now());

 insert into crm_access.user_roles(user_id,role_key) values
 (admin,'super_admin'),
 (outsider,'sales_executive');

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 lead_uuid:=(
   public.crm_save_lead(
     gen_random_uuid(),'create',null,null,
     jsonb_build_object(
       'customer_name','Timeline fixture',
       'source_code','manual',
       'priority','normal',
       'inquiry_on','2026-11-11',
       'assigned_user_id',admin
     )
   )->'lead'->>'id'
 )::uuid;

 for i in 1..23 loop
   perform public.crm_log_manual_activity(
     jsonb_build_object(
       'requestId',gen_random_uuid(),
       'leadId',lead_uuid,
       'activityId',gen_random_uuid(),
       'command','log',
       'data',jsonb_build_object(
         'kind','call',
         'summary','Fixture call '||i,
         'occurred_at','2026-01-01T00:00:00Z',
         'outcome',null,
         'notes',null
       )
     )
   );
 end loop;

 result:=public.crm_lead_timeline(lead_uuid,0);

 if result->>'total'<>'24'
   or jsonb_array_length(result->'rows')<>20
   or jsonb_array_length(
     public.crm_lead_timeline(lead_uuid,1)->'rows'
   )<>4
   or public.crm_lead_timeline(lead_uuid,2)->>'total'<>'24'
   or jsonb_array_length(
     public.crm_lead_timeline(lead_uuid,2)->'rows'
   )<>0 then
   raise exception 'Timeline pagination/count failed';
 end if;

 select array_agg(e->>'id') into first_ids
 from jsonb_array_elements(result->'rows') e;

 select array_agg(e->>'id') into last_ids
 from jsonb_array_elements(
   public.crm_lead_timeline(lead_uuid,1)->'rows'
 ) e;

 if first_ids && last_ids
   or result<>public.crm_lead_timeline(lead_uuid,0) then
   raise exception 'Timestamp-tie ordering failed';
 end if;

 perform public.crm_save_lead(
   gen_random_uuid(),'archive',lead_uuid,1,'{}'
 );

 if public.crm_lead_timeline(lead_uuid,0)->>'total'<>'25' then
   raise exception 'Archived history unavailable';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',outsider,'role','authenticated')::text,
   true
 );

 denied:=false;
 begin
   perform public.crm_lead_timeline(lead_uuid,0);
 exception when insufficient_privilege then
   denied:=true;
 end;

 if not denied then
   raise exception 'Unrelated employee accessed timeline';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 perform public.crm_change_employee_status(
   gen_random_uuid(),outsider,'active','inactive'
 );

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',outsider,'role','authenticated')::text,
   true
 );

 denied:=false;
 begin
   perform public.crm_lead_timeline(lead_uuid,0);
 exception when insufficient_privilege then
   denied:=true;
 end;

 if not denied then
   raise exception 'Inactive employee read timeline';
 end if;

 denied:=false;
 begin
   perform public.crm_lead_timeline(lead_uuid,-1);
 exception when invalid_parameter_value then
   denied:=true;
 end;

 if not denied then
   raise exception 'Invalid page accepted';
 end if;

 if has_function_privilege(
     'anon','public.crm_lead_timeline(uuid,integer)','EXECUTE'
   )
   or has_function_privilege(
     'service_role','public.crm_lead_timeline(uuid,integer)','EXECUTE'
   ) then
   raise exception 'Timeline grants leaked';
 end if;
end;
$$;

rollback;