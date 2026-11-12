-- Rollback-only worker fixtures.
-- No real scheduler/job or communication is started.
\set ON_ERROR_STOP on
begin;

do $$
declare
 admin uuid:=gen_random_uuid();
 owner uuid:=gen_random_uuid();
 successor uuid:=gen_random_uuid();
 lead_uuid uuid;
 task_uuid uuid:=gen_random_uuid();
 fields jsonb;
 cmd jsonb;
 r_id uuid;
 n bigint;
 denied boolean;
 result jsonb;
 i integer;
 batch integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (admin,'s16r-'||admin||'@example.test',now()),
 (owner,'s16r-'||owner||'@example.test',now()),
 (successor,'s16r-'||successor||'@example.test',now());

 insert into crm_access.user_roles(user_id,role_key) values
 (admin,'super_admin'),
 (owner,'sales_executive'),
 (successor,'sales_executive');

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 lead_uuid:=(
   public.crm_save_lead(
     gen_random_uuid(),'create',null,null,
     jsonb_build_object(
       'customer_name','Reminder fixture',
       'source_code','manual',
       'priority','normal',
       'assigned_user_id',owner,
       'inquiry_on','2026-11-11'
     )
   )->'lead'->>'id'
 )::uuid;

 fields:=jsonb_build_object(
   'title','Confidential task',
   'description',null,
   'kind','call',
   'priority','normal',
   'assigned_user_id',owner,
   'due_at','2026-01-01T00:00:00Z'
 );

 cmd:=jsonb_build_object(
   'requestId',gen_random_uuid(),
   'leadId',lead_uuid,
   'followUpId',task_uuid,
   'command','create',
   'version',null,
   'data',fields
 );

 perform public.crm_save_follow_up(cmd);
 perform crm_sales.generate_follow_up_reminders();
 perform crm_sales.generate_follow_up_reminders();

 select id into r_id
 from crm_sales.follow_up_reminders
 where follow_up_id=task_uuid;

 if r_id is null
   or (
     select count(*)
     from crm_sales.follow_up_reminders
     where follow_up_id=task_uuid
   )<>1 then
   raise exception 'Reminder dedupe failed';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',owner,'role','authenticated')::text,
   true
 );

 result:=public.crm_my_reminders(0);

 if result->>'total'<>'1'
   or result->>'unread'<>'1'
   or result->'rows'->0->>'title'<>'Follow-up due' then
   raise exception 'Recipient listing failed';
 end if;

 perform public.crm_read_reminder(r_id);
 perform public.crm_read_reminder(r_id);

 if public.crm_my_reminders(0)->>'unread'<>'0' then
   raise exception 'Read retry failed';
 end if;

 set local role authenticated;

 if (
   select count(*) from crm_sales.follow_up_reminders
 )<>1 then
   raise exception 'Recipient RLS failed';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',successor,'role','authenticated')::text,
   true
 );

 if exists(select 1 from crm_sales.follow_up_reminders) then
   raise exception 'Cross-user RLS leaked';
 end if;

 denied:=false;
 begin
   perform public.crm_read_reminder(r_id);
 exception when insufficient_privilege then
   denied:=true;
 end;

 if not denied then
   raise exception 'Cross-user mark read accepted';
 end if;

 reset role;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 perform public.crm_save_lead(
   gen_random_uuid(),'assign',lead_uuid,1,
   jsonb_build_object('assigned_user_id',successor)
 );

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',owner,'role','authenticated')::text,
   true
 );

 if public.crm_my_reminders(0)->>'total'<>'0' then
   raise exception 'Old owner reminder leaked';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 perform crm_sales.generate_follow_up_reminders();

 if (
   select count(*)
   from crm_sales.follow_up_reminders
   where follow_up_id=task_uuid
 )<>1 then
   raise exception 'Stale assignment generated reminder';
 end if;

 perform public.crm_save_follow_up(
   cmd||jsonb_build_object(
     'requestId',gen_random_uuid(),
     'command','update',
     'version',1,
     'data',(fields-'due_at')||
       jsonb_build_object('assigned_user_id',successor)
   )
 );

 perform crm_sales.generate_follow_up_reminders();

 if (
   select count(*)
   from crm_sales.follow_up_reminders
   where follow_up_id=task_uuid
 )<>2 then
   raise exception 'New owner reminder missing';
 end if;

 begin
   delete from crm_access.role_permissions
   where role_key='sales_executive'
     and permission_key='leads.view';

   if crm_sales.reminder_current(
     task_uuid,successor,'2026-01-01T00:00:00Z'
   ) then
     raise exception 'Revoked permission remained eligible';
   end if;

   -- Restore grants by rolling back this isolated subtransaction.
   raise no_data_found;
 exception when no_data_found then
   null;
 end;

 perform public.crm_change_employee_status(
   gen_random_uuid(),successor,'active','inactive'
 );

 if crm_sales.reminder_current(
   task_uuid,successor,'2026-01-01T00:00:00Z'
 ) then
   raise exception 'Inactive reminder eligible';
 end if;

 perform public.crm_change_employee_status(
   gen_random_uuid(),successor,'inactive','active'
 );

 perform public.crm_save_follow_up(
   cmd||jsonb_build_object(
     'requestId',gen_random_uuid(),
     'command','reschedule',
     'version',2,
     'data',jsonb_build_object(
       'due_at','2026-01-02T00:00:00Z',
       'reason','Different time'
     )
   )
 );

 select count(*) into n from crm_sales.follow_up_reminders;

 alter table crm_sales.reminder_runs
   add constraint reminder_fault check(false) not valid;

 denied:=false;
 begin
   perform crm_sales.generate_follow_up_reminders();
 exception when check_violation then
   denied:=true;
 end;

 if not denied
   or (
     select count(*) from crm_sales.follow_up_reminders
   )<>n then
   raise exception 'Worker atomic rollback failed';
 end if;

 alter table crm_sales.reminder_runs
   drop constraint reminder_fault;

 perform crm_sales.generate_follow_up_reminders();

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',successor,'role','authenticated')::text,
   true
 );

 if public.crm_my_reminders(0)->>'total'<>'1' then
   raise exception 'Reschedule invalidation failed';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 perform public.crm_save_follow_up(
   cmd||jsonb_build_object(
     'requestId',gen_random_uuid(),
     'command','cancel',
     'version',3,
     'data','{"reason":"No longer needed"}'::jsonb
   )
 );

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',successor,'role','authenticated')::text,
   true
 );

 if public.crm_my_reminders(0)->>'total'<>'0' then
   raise exception 'Closed reminder remained visible';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 -- Future tasks and Lost/archived leads must not generate reminders.
 perform public.crm_save_follow_up(
   cmd||jsonb_build_object(
     'requestId',gen_random_uuid(),
     'followUpId',gen_random_uuid(),
     'data',fields||jsonb_build_object(
       'assigned_user_id',successor,
       'due_at','2099-01-01T00:00:00Z'
     )
   )
 );

 perform crm_sales.generate_follow_up_reminders();

 if exists(
   select 1 from crm_sales.follow_up_reminders
   where lead_id=lead_uuid
     and due_at='2099-01-01T00:00:00Z'
 ) then
   raise exception 'Future reminder generated';
 end if;

 for i in 1..105 loop
   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'requestId',gen_random_uuid(),
       'followUpId',gen_random_uuid(),
       'data',fields||jsonb_build_object(
         'assigned_user_id',successor,
         'due_at','1950-01-01T00:00:00Z'
       )
     )
   );
 end loop;

 batch:=crm_sales.generate_follow_up_reminders();

 if batch<>100 then
   raise exception 'Worker batch was not bounded to 100';
 end if;

 perform crm_sales.generate_follow_up_reminders();

 if (
   select count(*)
   from crm_sales.follow_up_reminders
   where lead_id=lead_uuid
     and due_at='1950-01-01T00:00:00Z'
 )<>105 then
   raise exception 'Catch-up incomplete';
 end if;

 perform public.crm_transition_lead(
   gen_random_uuid(),lead_uuid,2,
   'lose','{"reasonCode":"cancelled"}'
 );

 if exists(
   select 1 from crm_sales.follow_up_reminders r
   where r.lead_id=lead_uuid
     and crm_sales.reminder_current(
       r.follow_up_id,r.recipient_id,r.due_at
     )
 ) then
   raise exception 'Lost reminder eligible';
 end if;

 perform public.crm_transition_lead(
   gen_random_uuid(),lead_uuid,3,
   'reopen','{"reason":"Resume fixture"}'
 );

 perform public.crm_save_lead(
   gen_random_uuid(),'archive',lead_uuid,4,'{}'
 );

 if exists(
   select 1 from crm_sales.follow_up_reminders r
   where r.lead_id=lead_uuid
     and crm_sales.reminder_current(
       r.follow_up_id,r.recipient_id,r.due_at
     )
 ) then
   raise exception 'Archived reminder eligible';
 end if;

 if has_function_privilege(
     'authenticated',
     'crm_sales.generate_follow_up_reminders()',
     'EXECUTE'
   )
   or has_function_privilege(
     'service_role',
     'public.crm_my_reminders(integer)',
     'EXECUTE'
   )
   or has_function_privilege(
     'anon',
     'public.crm_read_reminder(uuid)',
     'EXECUTE'
   ) then
   raise exception 'Reminder privilege leaked';
 end if;
end;
$$;

rollback;