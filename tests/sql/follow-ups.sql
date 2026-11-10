-- Generated, isolated fixtures. Every change and injected failure rolls back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';

do $$
declare
 admin uuid:=gen_random_uuid();
 sales uuid:=gen_random_uuid();
 successor uuid:=gen_random_uuid();
 manager uuid:=gen_random_uuid();
 nobody uuid:=gen_random_uuid();
 lead_uuid uuid;
 hidden uuid;
 task uuid:=gen_random_uuid();
 cancelled uuid:=gen_random_uuid();
 live uuid;
 fields jsonb;
 cmd jsonb;
 result jsonb;
 completed jsonb;
 log_cmd jsonb;
 payload jsonb;
 denied boolean;
 n bigint;
 i integer;
 k text;
 probe crm_sales.follow_ups%rowtype;
 fault uuid:=gen_random_uuid();
 stamp text:=to_char(
   (now()-interval '1 hour') at time zone 'UTC',
   'YYYY-MM-DD"T"HH24:MI:SS"Z"'
 );
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (admin,'s16-'||admin||'@example.test',now()),
 (sales,'s16-'||sales||'@example.test',now()),
 (successor,'s16-'||successor||'@example.test',now()),
 (manager,'s16-'||manager||'@example.test',now()),
 (nobody,'s16-'||nobody||'@example.test',now());

 insert into crm_access.user_roles(user_id,role_key) values
 (admin,'super_admin'),
 (sales,'sales_executive'),
 (successor,'sales_executive'),
 (manager,'management_director');

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 lead_uuid:=(
   public.crm_save_lead(
     gen_random_uuid(),'create',null,null,
     jsonb_build_object(
       'customer_name','Follow-up fixture',
       'assigned_user_id',sales,
       'source_code','manual',
       'priority','normal',
       'inquiry_on','2026-11-10'
     )
   )->'lead'->>'id'
 )::uuid;

 hidden:=(
   public.crm_save_lead(
     gen_random_uuid(),'create',null,null,
     jsonb_build_object(
       'customer_name','Other fixture',
       'assigned_user_id',successor,
       'source_code','manual',
       'priority','normal',
       'inquiry_on','2026-11-10'
     )
   )->'lead'->>'id'
 )::uuid;

 fields:=jsonb_build_object(
   'title','Discuss requirements',
   'description',null,
   'kind','call',
   'priority','normal',
   'assigned_user_id',sales,
   'due_at',stamp
 );

 cmd:=jsonb_build_object(
   'requestId',gen_random_uuid(),
   'leadId',lead_uuid,
   'followUpId',task,
   'command','create',
   'version',null,
   'data',fields
 );

 result:=public.crm_save_follow_up(cmd);

 if result->'followUp'->>'status'<>'open'
   or result->'followUp'->>'version'<>'1'
   or public.crm_save_follow_up(cmd)->>'replayed'<>'true' then
   raise exception 'Creation/retry failed';
 end if;

 denied:=false;
 begin
   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'data',fields||'{"title":"Changed"}'
     )
   );
 exception when invalid_parameter_value then
   denied:=true;
 end;
 if not denied then
   raise exception 'Changed request reused receipt';
 end if;

 foreach payload in array array[
   fields||'{"title":"!!!"}',
   fields-'title',
   fields||'{"due_at":null}',
   fields||'{"due_at":"2026-02-30T00:00:00Z"}',
   fields||jsonb_build_object('assigned_user_id',successor),
   fields||jsonb_build_object('assigned_user_id',manager),
   fields||'{"delivered":true}'
 ] loop
   denied:=false;
   begin
     perform public.crm_save_follow_up(
       cmd||jsonb_build_object(
         'requestId',gen_random_uuid(),
         'followUpId',gen_random_uuid(),
         'data',payload
       )
     );
   exception when
     invalid_parameter_value
     or check_violation
     or not_null_violation
     or datetime_field_overflow
   then
     denied:=true;
   end;
   if not denied then
     raise exception 'Invalid follow-up accepted';
   end if;
 end loop;

 select count(*) into n
 from crm_sales.follow_up_events
 where follow_up_id=task;

 perform public.crm_save_follow_up(
   cmd||jsonb_build_object(
     'command','update',
     'requestId',gen_random_uuid(),
     'version',1,
     'data',fields-'due_at'
   )
 );

 if (
   select count(*)
   from crm_sales.follow_up_events
   where follow_up_id=task
 )<>n then
   raise exception 'No-op fabricated audit';
 end if;

 denied:=false;
 begin
   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'command','update',
       'requestId',gen_random_uuid(),
       'version',1
     )
   );
 exception when invalid_parameter_value then
   denied:=true;
 end;
 if not denied then
   raise exception 'Ordinary update changed schedule';
 end if;

 result:=public.crm_save_follow_up(
   cmd||jsonb_build_object(
     'command','reschedule',
     'requestId',gen_random_uuid(),
     'version',1,
     'data',jsonb_build_object(
       'due_at',to_char(
         (now()+interval '1 day') at time zone 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS"Z"'
       ),
       'reason','Customer requested tomorrow'
     )
   )
 );

 if result->'followUp'->>'version'<>'2' then
   raise exception 'Reschedule failed';
 end if;

 denied:=false;
 begin
   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'command','cancel',
       'requestId',gen_random_uuid(),
       'version',1,
       'data','{"reason":"Stale edit"}'::jsonb
     )
   );
 exception when serialization_failure then
   denied:=true;
 end;
 if not denied then
   raise exception 'Stale edit accepted';
 end if;

 perform public.crm_save_lead(
   gen_random_uuid(),'assign',lead_uuid,1,
   jsonb_build_object('assigned_user_id',successor)
 );

 result:=public.crm_follow_up_page(lead_uuid,0,'all',false);

 if result->'rows'->0->>'needs_assignment_review'<>'true'
   or result->'rows'->0->>'assigned_user_id'<>sales::text then
   raise exception 'Historical owner/review failed';
 end if;

 completed:=cmd||jsonb_build_object(
   'command','complete',
   'requestId',gen_random_uuid(),
   'version',2,
   'data',jsonb_build_object(
     'actual_at',stamp,
     'outcome','Discussed room preferences'
   )
 );

 denied:=false;
 begin
   perform public.crm_save_follow_up(completed);
 exception when invalid_parameter_value then
   denied:=true;
 end;
 if not denied then
   raise exception 'Stale owner completion accepted';
 end if;

 perform public.crm_save_follow_up(
   cmd||jsonb_build_object(
     'command','update',
     'requestId',gen_random_uuid(),
     'version',2,
     'data',(fields-'due_at')||
       jsonb_build_object('assigned_user_id',successor)
   )
 );

 if not exists(
   select 1 from crm_sales.follow_up_events
   where follow_up_id=task and actions=array['reassigned']
 ) then
   raise exception 'Reassignment history missing';
 end if;

 completed:=completed||jsonb_build_object('version',3);

 foreach payload in array array[
   (completed->'data')||'{"outcome":"!!!"}',
   (completed->'data')||jsonb_build_object(
     'actual_at',to_char(
       (now()+interval '1 day') at time zone 'UTC',
       'YYYY-MM-DD"T"HH24:MI:SS"Z"'
     )
   )
 ] loop
   denied:=false;
   begin
     perform public.crm_save_follow_up(
       completed||jsonb_build_object(
         'requestId',gen_random_uuid(),'data',payload
       )
     );
   exception when invalid_parameter_value then
     denied:=true;
   end;
   if not denied then
     raise exception 'Invalid completion accepted';
   end if;
 end loop;

 execute format(
   'alter table crm_sales.follow_up_events add constraint s16_fault check(follow_up_id<>%L::uuid) not valid',
   task
 );

 denied:=false;
 begin
   perform public.crm_save_follow_up(
     completed||jsonb_build_object('requestId',fault)
   );
 exception when check_violation then
   denied:=true;
 end;

 if not denied
   or (
     select version from crm_sales.follow_ups where id=task
   )<>3
   or exists(
     select 1 from crm_sales.manual_activities
     where follow_up_id=task
   )
   or exists(
     select 1 from crm_sales.sales_requests
     where request_id=fault
   ) then
   raise exception 'Atomic completion rollback failed';
 end if;

 alter table crm_sales.follow_up_events
   drop constraint s16_fault;

 result:=public.crm_save_follow_up(completed);

 if result->'followUp'->>'status'<>'completed'
   or result->'followUp'->>'finalized_by'<>admin::text
   or public.crm_save_follow_up(completed)->>'replayed'<>'true'
   or (
     select count(*) from crm_sales.manual_activities
     where follow_up_id=task
   )<>1 then
   raise exception 'Atomic completion/retry failed';
 end if;

 denied:=false;
 begin
   update crm_sales.follow_ups
   set title='Changed'
   where id=task;
 exception when insufficient_privilege then
   denied:=true;
 end;
 if not denied then
   raise exception 'Finalized trigger failed';
 end if;

 foreach k in array array[
   'update','complete','cancel','reschedule'
 ] loop
   denied:=false;
   begin
     perform public.crm_save_follow_up(
       cmd||jsonb_build_object(
         'command',k,
         'requestId',gen_random_uuid(),
         'version',4
       )
     );
   exception when serialization_failure then
     denied:=true;
   end;
   if not denied then
     raise exception 'Terminal follow-up mutable';
   end if;
 end loop;

 fields:=fields||
   jsonb_build_object('assigned_user_id',successor);

 perform public.crm_save_follow_up(
   cmd||jsonb_build_object(
     'requestId',gen_random_uuid(),
     'followUpId',cancelled,
     'data',fields
   )
 );

 denied:=false;
 begin
   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'command','cancel',
       'requestId',gen_random_uuid(),
       'followUpId',cancelled,
       'version',1,
       'data','{"reason":" "}'::jsonb
     )
   );
 exception when invalid_parameter_value then
   denied:=true;
 end;
 if not denied then
   raise exception 'Blank cancellation accepted';
 end if;

 perform public.crm_save_follow_up(
   cmd||jsonb_build_object(
     'command','cancel',
     'requestId',gen_random_uuid(),
     'followUpId',cancelled,
     'version',1,
     'data','{"reason":"No longer required"}'::jsonb
   )
 );

 denied:=false;
 begin
   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'command','update',
       'requestId',gen_random_uuid(),
       'followUpId',cancelled,
       'version',2,
       'data',fields-'due_at'
     )
   );
 exception when serialization_failure then
   denied:=true;
 end;
 if not denied then
   raise exception 'Cancelled task reopened';
 end if;

 log_cmd:=jsonb_build_object(
   'requestId',gen_random_uuid(),
   'leadId',lead_uuid,
   'activityId',gen_random_uuid(),
   'command','log',
   'data',jsonb_build_object(
     'kind','call',
     'summary','Employee recorded a discussion',
     'occurred_at',stamp,
     'outcome',null,
     'notes',null
   )
 );

 foreach k in array array[
   'call','meeting','whatsapp','email'
 ] loop
   payload:=log_cmd||jsonb_build_object(
     'requestId',gen_random_uuid(),
     'activityId',gen_random_uuid(),
     'data',(log_cmd->'data')||jsonb_build_object('kind',k)
   );

   perform public.crm_log_manual_activity(payload);

   if public.crm_log_manual_activity(payload)->>'replayed'<>'true' then
     raise exception 'Manual retry failed';
   end if;
 end loop;

 foreach payload in array array[
   (log_cmd->'data')||'{"delivered":true}',
   (log_cmd->'data')||'{"kind":"site_visit"}',
   (log_cmd->'data')||jsonb_build_object(
     'occurred_at',to_char(
       (now()+interval '1 day') at time zone 'UTC',
       'YYYY-MM-DD"T"HH24:MI:SS"Z"'
     )
   )
 ] loop
   denied:=false;
   begin
     perform public.crm_log_manual_activity(
       log_cmd||jsonb_build_object('data',payload)
     );
   exception when invalid_parameter_value then
     denied:=true;
   end;
   if not denied then
     raise exception 'Forged/future manual log accepted';
   end if;
 end loop;

 denied:=false;
 begin
   update crm_sales.manual_activities
   set summary='Changed'
   where lead_id=lead_uuid;
 exception when insufficient_privilege then
   denied:=true;
 end;
 if not denied then
   raise exception 'Immutable activity changed';
 end if;

 for i in 1..21 loop
   live:=gen_random_uuid();

   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'requestId',gen_random_uuid(),
       'followUpId',live,
       'data',fields
     )
   );
 end loop;

 if public.crm_follow_up_page(
     lead_uuid,0,'all',false
   )->>'total'<>'23'
   or jsonb_array_length(
     public.crm_follow_up_page(
       lead_uuid,0,'all',false
     )->'rows'
   )<>20
   or jsonb_array_length(
     public.crm_follow_up_page(
       lead_uuid,1,'all',false
     )->'rows'
   )<>3
   or public.crm_follow_up_page(
     lead_uuid,2,'all',false
   )->>'total'<>'23'
   or jsonb_array_length(
     public.crm_follow_up_page(
       lead_uuid,2,'all',false
     )->'rows'
   )<>0 then
   raise exception 'Pagination/count failed';
 end if;

 if public.crm_follow_up_page(
     lead_uuid,0,'overdue',false
   )->>'total'<>'21'
   or public.crm_follow_up_page(
     lead_uuid,0,'completed',false
   )->>'total'<>'1'
   or public.crm_manual_activity_page(
     lead_uuid,0
   )->>'total'<>'5' then
   raise exception 'Filtered counts/activity linkage failed';
 end if;

 select * into probe
 from crm_sales.follow_ups
 where id=live;

 probe.due_at:='2026-11-10T20:00:00Z';

 if not crm_sales.follow_up_matches(
     probe,lead_uuid,'today',false,'2026-11-10T20:30:00Z'
   )
   or crm_sales.follow_up_matches(
     probe,lead_uuid,'overdue',false,'2026-11-10T20:00:00Z'
   )
   or not crm_sales.follow_up_matches(
     probe,lead_uuid,'upcoming',false,'2026-11-10T20:00:00Z'
   ) then
   raise exception 'Dubai boundary/exact due time failed';
 end if;

 probe.due_at:='2026-11-10T19:59:00Z';

 if crm_sales.follow_up_matches(
   probe,lead_uuid,'today',false,'2026-11-10T20:30:00Z'
 ) then
   raise exception 'Previous Dubai day included';
 end if;

 denied:=false;
 begin
   update crm_sales.follow_ups
   set status='completed',
     actual_at=now(),
     outcome='Wrong task activity',
     completed_activity_id=(
       select completed_activity_id
       from crm_sales.follow_ups
       where id=task
     ),
     finalized_by=admin,
     finalized_at=now()
   where id=live;

   set constraints all immediate;
 exception when foreign_key_violation then
   denied:=true;
 end;

 set constraints all deferred;

 if not denied then
   raise exception 'Completion linked another task activity';
 end if;

 perform public.crm_change_employee_status(
   gen_random_uuid(),successor,'active','inactive'
 );

 if public.crm_follow_up_page(
   lead_uuid,0,'open',false
 )->'rows'->0->>'needs_assignment_review'<>'true' then
   raise exception 'Inactive owner not flagged';
 end if;

 denied:=false;
 begin
   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'requestId',gen_random_uuid(),
       'followUpId',gen_random_uuid(),
       'data',fields
     )
   );
 exception when invalid_parameter_value then
   denied:=true;
 end;
 if not denied then
   raise exception 'Inactive assignment accepted';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object(
     'sub',successor,'role','authenticated'
   )::text,
   true
 );

 denied:=false;
 begin
   perform public.crm_follow_up_page(lead_uuid,0,'all',false);
 exception when insufficient_privilege then
   denied:=true;
 end;
 if not denied then
   raise exception 'Inactive employee read accepted';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 perform public.crm_change_employee_status(
   gen_random_uuid(),successor,'inactive','active'
 );

 set local role authenticated;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',sales,'role','authenticated')::text,
   true
 );

 if exists(
   select 1 from crm_sales.follow_ups where lead_id=lead_uuid
 )
 or exists(
   select 1 from crm_sales.manual_activities where lead_id=lead_uuid
 )
 or exists(
   select 1 from crm_sales.follow_up_events where lead_id=lead_uuid
 ) then
   raise exception 'Cross-lead RLS leak';
 end if;

 denied:=false;
 begin
   perform public.crm_save_follow_up(cmd);
 exception when insufficient_privilege then
   denied:=true;
 end;
 if not denied then
   raise exception 'Revoked access replay accepted';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object(
     'sub',successor,'role','authenticated'
   )::text,
   true
 );

 if public.crm_follow_up_page(
     lead_uuid,0,'all',false
   )->>'total'<>'23'
   or public.crm_follow_up_page(
     null,0,'all',true
   )->>'total'<>'23' then
   raise exception 'Scoped lead/mine visibility failed';
 end if;

 denied:=false;
 begin
   perform public.crm_follow_up_page(null,0,'all',false);
 exception when insufficient_privilege then
   denied:=true;
 end;
 if not denied then
   raise exception 'Scoped employee accessed team view';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object(
     'sub',manager,'role','authenticated'
   )::text,
   true
 );

 if public.crm_follow_up_page(
   lead_uuid,0,'open',false
 )->'rows'->0->>'read_only'<>'true' then
   raise exception 'Read-only management flag missing';
 end if;

 denied:=false;
 begin
   perform public.crm_log_manual_activity(log_cmd);
 exception when insufficient_privilege then
   denied:=true;
 end;
 if not denied then
   raise exception 'Management mutation accepted';
 end if;

 denied:=false;
 begin
   delete from crm_sales.follow_ups where lead_id=lead_uuid;
 exception when insufficient_privilege then
   denied:=true;
 end;
 if not denied then
   raise exception 'Direct deletion allowed';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object(
     'sub',nobody,'role','authenticated'
   )::text,
   true
 );

 denied:=false;
 begin
   perform public.crm_manual_activity_page(lead_uuid,0);
 exception when insufficient_privilege then
   denied:=true;
 end;
 if not denied then
   raise exception 'Roleless read accepted';
 end if;

 reset role;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin,'role','authenticated')::text,
   true
 );

 denied:=false;
 begin
   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'requestId',gen_random_uuid(),
       'leadId',hidden,
       'command','cancel',
       'version',4,
       'data','{"reason":"Cross-lead attempt"}'::jsonb
     )
   );
 exception when insufficient_privilege then
   denied:=true;
 end;
 if not denied then
   raise exception 'Cross-lead record accepted';
 end if;

 perform public.crm_transition_lead(
   gen_random_uuid(),lead_uuid,2,
   'lose','{"reasonCode":"cancelled"}'
 );

 denied:=false;
 begin
   perform public.crm_log_manual_activity(log_cmd);
 exception when serialization_failure then
   denied:=true;
 end;
 if not denied then
   raise exception 'Lost lead mutated';
 end if;

 if public.crm_save_follow_up(completed)->>'replayed'<>'true' then
   raise exception 'Committed replay unavailable after closure';
 end if;

 perform public.crm_transition_lead(
   gen_random_uuid(),lead_uuid,3,
   'reopen','{"reason":"Resume fixture"}'
 );

 perform public.crm_save_lead(
   gen_random_uuid(),'archive',lead_uuid,4,'{}'
 );

 if public.crm_follow_up_page(
     lead_uuid,0,'open',false
   )->'rows'->0->>'read_only'<>'true'
   or public.crm_manual_activity_page(
     lead_uuid,0
   )->>'readOnly'<>'true' then
   raise exception 'Archive lost history/read-only';
 end if;

 denied:=false;
 begin
   perform public.crm_save_follow_up(
     cmd||jsonb_build_object(
       'command','cancel',
       'requestId',gen_random_uuid(),
       'followUpId',live,
       'version',1,
       'data','{"reason":"Archived"}'::jsonb
     )
   );
 exception when serialization_failure then
   denied:=true;
 end;
 if not denied then
   raise exception 'Archived lead mutated';
 end if;

 if has_table_privilege(
     'authenticated',
     'crm_sales.sales_requests',
     'SELECT,INSERT,UPDATE,DELETE'
   )
   or has_function_privilege(
     'anon',
     'public.crm_save_follow_up(jsonb)',
     'EXECUTE'
   )
   or has_function_privilege(
     'service_role',
     'public.crm_log_manual_activity(jsonb)',
     'EXECUTE'
   ) then
   raise exception 'Privilege boundary leaked';
 end if;
end;
$$;

rollback;