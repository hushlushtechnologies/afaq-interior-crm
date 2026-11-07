-- Isolated local fixtures. All records, status changes and fault injection roll back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
do $$
declare
 admin uuid:=gen_random_uuid(); sales uuid:=gen_random_uuid(); next_sales uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); roleless uuid:=gen_random_uuid();
 lead_uuid uuid; first_uuid uuid:=gen_random_uuid(); cancel_uuid uuid:=gen_random_uuid(); live_uuid uuid;
 cmd jsonb; fields jsonb; edited jsonb; result jsonb; payload jsonb; complete_cmd jsonb; denied boolean; baseline bigint; i integer;
 fault_uuid uuid:=gen_random_uuid(); action text;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (admin,'s15v-'||admin||'@example.test',now()),(sales,'s15v-'||sales||'@example.test',now()),
 (next_sales,'s15v-'||next_sales||'@example.test',now()),(manager,'s15v-'||manager||'@example.test',now()),(roleless,'s15v-'||roleless||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values(admin,'super_admin'),(sales,'sales_executive'),(next_sales,'sales_executive'),(manager,'management_director');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 lead_uuid:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,jsonb_build_object('customer_name','Visit fixture','assigned_user_id',sales,
   'source_code','manual','priority','normal','inquiry_on','2026-11-07'))->'lead'->>'id')::uuid;
 fields:=jsonb_build_object('scheduled_at',to_char((now()+interval '1 day') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
   'assigned_user_id',sales,'location',null,'notes',null,'measurements',null,'observations',null);
 cmd:=jsonb_build_object('command','create','requestId',gen_random_uuid(),'leadId',lead_uuid,'visitId',first_uuid,'version',null,'data',fields);
 result:=public.crm_save_site_visit(cmd);
 if result->'visit'->>'status'<>'planned' or result->'visit'->>'version'<>'1' then raise exception 'Planned creation failed'; end if;
 if public.crm_save_site_visit(cmd)->>'replayed'<>'true' then raise exception 'Create retry failed'; end if;
 denied:=false;
 begin perform public.crm_save_site_visit(cmd||jsonb_build_object('data',fields||'{"notes":"Changed"}')); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Changed input reused receipt'; end if;
 select count(*) into baseline from crm_sales.visit_events where lead_id=lead_uuid;
 perform public.crm_save_site_visit(cmd||jsonb_build_object('command','update','requestId',gen_random_uuid(),'version',1));
 if (select count(*) from crm_sales.visit_events where lead_id=lead_uuid)<>baseline then raise exception 'No-op generated history'; end if;
 foreach payload in array array[fields||'{"scheduled_at":null}',fields||'{"scheduled_at":"2026-02-30T10:00:00Z"}',
   fields||'{"scheduled_at":"2026-11-07T24:00:00Z"}',fields||'{"status":"completed"}',fields-'notes',fields||jsonb_build_object('assigned_user_id',admin)] loop
   denied:=false;
   begin perform public.crm_save_site_visit(cmd||jsonb_build_object('visitId',gen_random_uuid(),'requestId',gen_random_uuid(),'data',payload));
   exception when invalid_parameter_value or datetime_field_overflow or invalid_datetime_format then denied:=true; end;
   if not denied then raise exception 'Invalid schedule, authority or arbitrary assignee accepted'; end if;
 end loop;
 edited:=fields||jsonb_build_object('scheduled_at',to_char((now()-interval '2 hours') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'assigned_user_id',null,'notes','Unverified measurements recorded');
 perform public.crm_save_site_visit(cmd||jsonb_build_object('command','update','requestId',gen_random_uuid(),'version',1,'data',edited));
 if not exists(select 1 from crm_sales.visit_events where visit_id=first_uuid and actions=array['scheduled','assigned','updated']) then raise exception 'Schedule/assignment/content history missing'; end if;
 denied:=false;
 begin perform public.crm_save_site_visit(cmd||jsonb_build_object('command','update','requestId',gen_random_uuid(),'version',1)); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Stale update accepted'; end if;
 execute format('alter table crm_sales.visit_events add constraint s15_visit_fault check(visit_id<>%L::uuid) not valid',first_uuid);
 denied:=false;
 begin perform public.crm_save_site_visit(cmd||jsonb_build_object('command','update','requestId',fault_uuid,'version',2,'data',edited||'{"notes":"Must roll back"}'));
 exception when check_violation then denied:=true; end;
 if not denied or (select version from crm_sales.site_visits where id=first_uuid)<>2
   or exists(select 1 from crm_sales.visit_requests where request_id=fault_uuid and actor_id=admin) then raise exception 'Visit audit rollback failed'; end if;
 alter table crm_sales.visit_events drop constraint s15_visit_fault;
 perform public.crm_save_site_visit(cmd||jsonb_build_object('command','update','requestId',gen_random_uuid(),'version',2,'data',edited||jsonb_build_object('assigned_user_id',sales)));
 perform public.crm_save_lead(gen_random_uuid(),'assign',lead_uuid,1,jsonb_build_object('assigned_user_id',next_sales));
 result:=public.crm_site_visits(lead_uuid,0);
 if result->'rows'->0->>'needs_assignment_review'<>'true' or result->'rows'->0->>'assigned_user_id'<>sales::text then raise exception 'Historical assignment/review flag failed'; end if;
 complete_cmd:=cmd||jsonb_build_object('command','complete','requestId',gen_random_uuid(),'version',3,
   'data',jsonb_build_object('actual_at',to_char((now()-interval '1 hour') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'outcome','Measurements taken'));
 foreach payload in array array[jsonb_build_object('actual_at',to_char((now()+interval '1 hour') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'outcome','Future'),
   (complete_cmd->'data')||'{"outcome":"  "}',(complete_cmd->'data')||'{"outcome":"!!!"}'] loop
   denied:=false;
   begin perform public.crm_save_site_visit(complete_cmd||jsonb_build_object('requestId',gen_random_uuid(),'data',payload)); exception when invalid_parameter_value then denied:=true; end;
   if not denied then raise exception 'Invalid completion accepted'; end if;
 end loop;
 result:=public.crm_save_site_visit(complete_cmd);
 if result->'visit'->>'status'<>'completed' or result->'visit'->>'finalized_by'<>admin::text
   or result->'visit'->>'assigned_user_id'<>sales::text then raise exception 'Completion evidence/assignment failed'; end if;
 if public.crm_save_site_visit(complete_cmd)->>'replayed'<>'true' then raise exception 'Completion replay failed'; end if;
 foreach action in array array['update','complete','cancel'] loop
   denied:=false;
   begin perform public.crm_save_site_visit(cmd||jsonb_build_object('command',action,'requestId',gen_random_uuid(),'version',4)); exception when serialization_failure then denied:=true; end;
   if not denied then raise exception 'Completed visit was mutable'; end if;
 end loop;
 denied:=false;
 begin update crm_sales.site_visits set notes='Forbidden correction' where id=first_uuid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Finalized-row trigger failed'; end if;
 perform public.crm_save_site_visit(cmd||jsonb_build_object('requestId',gen_random_uuid(),'visitId',cancel_uuid,'data',fields||jsonb_build_object('assigned_user_id',next_sales)));
 denied:=false;
 begin perform public.crm_save_site_visit(cmd||jsonb_build_object('command','cancel','requestId',gen_random_uuid(),'visitId',cancel_uuid,'version',1,'data','{"reason":" "}'::jsonb));
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Blank cancellation accepted'; end if;
 result:=public.crm_save_site_visit(cmd||jsonb_build_object('command','cancel','requestId',gen_random_uuid(),'visitId',cancel_uuid,'version',1,'data','{"reason":"Customer postponed"}'::jsonb));
 if result->'visit'->>'status'<>'cancelled' or result->'visit'->>'finalized_at' is null then raise exception 'Cancellation evidence missing'; end if;
 foreach action in array array['update','complete','cancel'] loop
   denied:=false;
   begin perform public.crm_save_site_visit(cmd||jsonb_build_object('command',action,'requestId',gen_random_uuid(),'visitId',cancel_uuid,'version',2)); exception when serialization_failure then denied:=true; end;
   if not denied then raise exception 'Cancelled visit was mutable'; end if;
 end loop;
 perform public.crm_change_employee_status(gen_random_uuid(),next_sales,'active','inactive');
 denied:=false;
 begin perform public.crm_save_site_visit(cmd||jsonb_build_object('requestId',gen_random_uuid(),'visitId',gen_random_uuid(),'data',fields||jsonb_build_object('assigned_user_id',next_sales)));
 exception when invalid_parameter_value then denied:=true; end;
 if not denied or public.crm_site_visits(lead_uuid,0)->'owner'<>'null'::jsonb then raise exception 'Inactive assignment owner accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',next_sales,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_site_visits(lead_uuid,0); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Inactive visit read accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 perform public.crm_change_employee_status(gen_random_uuid(),next_sales,'inactive','active');
 for i in 1..21 loop
   live_uuid:=gen_random_uuid();
   perform public.crm_save_site_visit(cmd||jsonb_build_object('requestId',gen_random_uuid(),'visitId',live_uuid,'data',fields||'{"assigned_user_id":null}'));
 end loop;
 result:=public.crm_site_visits(lead_uuid,0);
 if result->>'total'<>'23' or jsonb_array_length(result->'rows')<>20 or jsonb_array_length(public.crm_site_visits(lead_uuid,1)->'rows')<>3 then raise exception 'Visit pagination failed'; end if;
 set local role authenticated;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales,'role','authenticated')::text,true);
 if exists(select 1 from crm_sales.site_visits where lead_id=lead_uuid) or exists(select 1 from crm_sales.visit_events where lead_id=lead_uuid) then raise exception 'Hidden visit/history RLS leak'; end if;
 denied:=false;
 begin perform public.crm_save_site_visit(cmd); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked visibility replay accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 if public.crm_site_visits(lead_uuid,0)->>'readOnly'<>'true' then raise exception 'Management read-only flag missing'; end if;
 denied:=false;
 begin perform public.crm_save_site_visit(cmd); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Management visit mutation accepted'; end if;
 denied:=false;
 begin delete from crm_sales.site_visits where lead_id=lead_uuid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct visit deletion accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',roleless,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_site_visits(lead_uuid,0); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Roleless visit read accepted'; end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 perform public.crm_transition_lead(gen_random_uuid(),lead_uuid,2,'lose','{"reasonCode":"cancelled"}');
 denied:=false;
 begin perform public.crm_save_site_visit(cmd||jsonb_build_object('command','update','requestId',gen_random_uuid(),'visitId',live_uuid,'version',1)); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Lost lead visit mutated'; end if;
 perform public.crm_transition_lead(gen_random_uuid(),lead_uuid,3,'reopen','{"reason":"Local resumption"}');
 perform public.crm_save_lead(gen_random_uuid(),'archive',lead_uuid,4,'{}');
 if public.crm_site_visits(lead_uuid,0)->>'total'<>'23' or public.crm_site_visits(lead_uuid,0)->>'readOnly'<>'true' then raise exception 'Archived visit history disappeared'; end if;
 denied:=false;
 begin perform public.crm_save_site_visit(cmd||jsonb_build_object('command','update','requestId',gen_random_uuid(),'visitId',live_uuid,'version',1)); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Archived lead visit mutated'; end if;
 if has_table_privilege('authenticated','crm_sales.visit_requests','SELECT,INSERT,UPDATE,DELETE')
   or has_function_privilege('anon','public.crm_save_site_visit(jsonb)','EXECUTE')
   or has_function_privilege('service_role','public.crm_site_visits(uuid,integer)','EXECUTE') then raise exception 'Visit privilege boundary leaked'; end if;
end;
$$;
rollback;