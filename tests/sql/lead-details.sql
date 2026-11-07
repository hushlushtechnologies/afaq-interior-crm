-- Isolated local fixtures only. All data, role probes and fault injection roll back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
do $$
declare
 sales uuid:=gen_random_uuid(); other_sales uuid:=gen_random_uuid(); admin uuid:=gen_random_uuid();
 manager uuid:=gen_random_uuid(); roleless uuid:=gen_random_uuid(); lead_uuid uuid; room_uuid uuid:=gen_random_uuid();
 note_uuid uuid:=gen_random_uuid(); req jsonb; room jsonb; cmd jsonb; retry_cmd jsonb; result jsonb;
 baseline bigint; denied boolean; i integer; failing_request uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (sales,'s15-'||sales||'@example.test',now()),(other_sales,'s15-'||other_sales||'@example.test',now()),
 (admin,'s15-'||admin||'@example.test',now()),(manager,'s15-'||manager||'@example.test',now()),
 (roleless,'s15-'||roleless||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values
 (sales,'sales_executive'),(other_sales,'sales_executive'),(admin,'super_admin'),(manager,'management_director');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales,'role','authenticated')::text,true);
 lead_uuid:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,jsonb_build_object(
   'customer_name','Sprint 15 fixture','source_code','manual','priority','normal',
   'assigned_user_id',sales,'inquiry_on','2026-11-07'))->'lead'->>'id')::uuid;
 select jsonb_object_agg(k,null::text) into req from unnest(array[
 'project_type','property_type','location_description','style_preferences','material_preferences',
 'furniture_preferences','color_preferences','budget_estimate','currency','desired_start_date',
 'desired_completion_date','special_instructions','completion_state']) k;
 req:=req||'{"currency":"AED","completion_state":"not_started"}';
 cmd:=jsonb_build_object('command','save_requirements','requestId',gen_random_uuid(),'leadId',lead_uuid,'version',null,'data',req);
 result:=public.crm_save_lead_detail(cmd); retry_cmd:=cmd;
 if result->'record'->>'id'<>lead_uuid::text or result->'record'->>'version'<>'1' then raise exception 'Requirements create failed'; end if;
 select count(*) into baseline from crm_sales.detail_events where lead_id=lead_uuid;
 if public.crm_save_lead_detail(cmd)->>'replayed'<>'true' then raise exception 'Exact retry failed'; end if;
 denied:=false;
 begin perform public.crm_save_lead_detail(cmd||jsonb_build_object('data',req||'{"style_preferences":"Different"}'));
 exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Changed input reused request ID'; end if;
 denied:=false;
 begin perform public.crm_save_lead_detail(cmd||jsonb_build_object('requestId',gen_random_uuid()));
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Conflicting create was accepted'; end if;
 perform public.crm_save_lead_detail(cmd||jsonb_build_object('requestId',gen_random_uuid(),'version',1));
 if (select count(*) from crm_sales.detail_events where lead_id=lead_uuid)<>baseline then raise exception 'No-op manufactured history'; end if;
 foreach result in array array[
   req||'{"budget_estimate":"1.001"}',req||'{"budget_estimate":1}',req||'{"desired_start_date":"2026-02-30"}',
   req||'{"desired_start_date":"0000-01-01"}',req||'{"desired_start_date":"2026-11-08","desired_completion_date":"2026-11-07"}',
   req||'{"actor_id":"fake"}',req-'project_type',req||'{"completion_state":"approved"}'
 ] loop
   denied:=false;
   begin perform public.crm_save_lead_detail(cmd||jsonb_build_object('requestId',gen_random_uuid(),'version',1,'data',result));
   exception when invalid_parameter_value then denied:=true; end;
   if not denied then raise exception 'Invalid detail payload accepted'; end if;
 end loop;
 room:='{"name":"Repeated room","room_type":null,"sort_order":0,"requirements_notes":null,"measurement_notes":"Unverified 4 x 5 m","deliverables_notes":null}';
 for i in 1..21 loop
   perform public.crm_save_lead_detail(jsonb_build_object('command','save_room','requestId',gen_random_uuid(),
     'leadId',lead_uuid,'recordId',case when i=1 then room_uuid else gen_random_uuid() end,'version',null,'data',room));
 end loop;
 result:=public.crm_lead_details(lead_uuid,'room',0);
 if result->>'total'<>'21' or jsonb_array_length(result->'rows')<>20 then raise exception 'Room pagination failed'; end if;
 if jsonb_array_length(public.crm_lead_details(lead_uuid,'room',1)->'rows')<>1 then raise exception 'Second room page failed'; end if;
 cmd:=jsonb_build_object('command','save_room','requestId',gen_random_uuid(),'leadId',lead_uuid,'recordId',room_uuid,'version',1,
   'data',room||'{"requirements_notes":"Changed"}');
 perform public.crm_save_lead_detail(cmd);
 denied:=false;
 begin perform public.crm_save_lead_detail(cmd||jsonb_build_object('requestId',gen_random_uuid())); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Stale room update accepted'; end if;
 perform public.crm_save_lead_detail(jsonb_build_object('command','save_note','requestId',gen_random_uuid(),'leadId',lead_uuid,
   'recordId',note_uuid,'version',null,'data',jsonb_build_object('body','Original internal note')));
 -- Execute with the actual database role, not just JWT claims.
 set local role authenticated;
 if (select count(*) from crm_sales.detail_records where lead_id=lead_uuid)<>23 then raise exception 'Own record RLS failed'; end if;
 denied:=false;
 begin update crm_sales.detail_records set data='{}' where lead_id=lead_uuid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct detail mutation accepted'; end if;
 denied:=false;
 begin delete from crm_sales.detail_events where lead_id=lead_uuid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'History deletion accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_sales,'role','authenticated')::text,true);
 if exists(select 1 from crm_sales.detail_records where lead_id=lead_uuid)
   or exists(select 1 from crm_sales.detail_events where lead_id=lead_uuid) then raise exception 'RLS leaked hidden details/history'; end if;
 denied:=false;
 begin perform public.crm_lead_details(lead_uuid,'note',0); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Hidden RPC read accepted'; end if;
 denied:=false;
 begin perform public.crm_save_lead_detail(cmd||jsonb_build_object('requestId',gen_random_uuid(),'version',2)); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Hidden RPC write accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 if public.crm_lead_details(lead_uuid,'room',0)->>'total'<>'21' then raise exception 'Management read failed'; end if;
 denied:=false;
 begin perform public.crm_save_lead_detail(cmd||jsonb_build_object('requestId',gen_random_uuid(),'version',2)); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Management wrote details'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',roleless,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_lead_details(lead_uuid,'note',0); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Roleless read accepted'; end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 perform public.crm_save_lead(gen_random_uuid(),'assign',lead_uuid,1,jsonb_build_object('assigned_user_id',other_sales));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_save_lead_detail(retry_cmd); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Receipt replay bypassed current visibility'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_sales,'role','authenticated')::text,true);
 cmd:=jsonb_build_object('command','save_note','requestId',gen_random_uuid(),'leadId',lead_uuid,'recordId',note_uuid,'version',1,
   'data',jsonb_build_object('body','Attempted replacement'));
 denied:=false;
 begin perform public.crm_save_lead_detail(cmd); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Sales edited another author note'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 perform public.crm_save_lead_detail(cmd||jsonb_build_object('requestId',gen_random_uuid()));
 if (select created_by from crm_sales.detail_records where lead_id=lead_uuid and id=note_uuid)<>sales then raise exception 'Note author overwritten'; end if;
 -- A later audit failure must roll back the record update and receipt too.
 execute format('alter table crm_sales.detail_events add constraint s15_fault check(record_id<>%L::uuid) not valid',room_uuid);
 denied:=false;
 begin perform public.crm_save_lead_detail(jsonb_build_object('command','save_room','requestId',failing_request,'leadId',lead_uuid,
   'recordId',room_uuid,'version',2,'data',room||'{"requirements_notes":"Must roll back"}'));
 exception when check_violation then denied:=true; end;
 if not denied or (select version from crm_sales.detail_records where lead_id=lead_uuid and id=room_uuid)<>2
   or exists(select 1 from crm_sales.detail_requests where actor_id=admin and request_id=failing_request) then raise exception 'Audit rollback failed'; end if;
 alter table crm_sales.detail_events drop constraint s15_fault;
 perform public.crm_transition_lead(gen_random_uuid(),lead_uuid,2,'lose','{"reasonCode":"cancelled"}');
 denied:=false;
 begin perform public.crm_save_lead_detail(cmd||jsonb_build_object('requestId',gen_random_uuid(),'version',2)); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Lost details were mutable'; end if;
 perform public.crm_transition_lead(gen_random_uuid(),lead_uuid,3,'reopen','{"reason":"Synthetic resumption"}');
 perform public.crm_save_lead(gen_random_uuid(),'archive',lead_uuid,4,'{}');
 if public.crm_lead_details(lead_uuid,'note',0)->>'total'<>'1' then raise exception 'Archived history disappeared'; end if;
 denied:=false;
 begin perform public.crm_save_lead_detail(cmd||jsonb_build_object('requestId',gen_random_uuid(),'version',2)); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Archived details were mutable'; end if;
 perform public.crm_change_employee_status(gen_random_uuid(),other_sales,'active','inactive');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_sales,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_lead_details(lead_uuid,'room',0); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Inactive read accepted'; end if;
 if has_table_privilege('authenticated','crm_sales.detail_requests','SELECT,INSERT,UPDATE,DELETE')
   or has_function_privilege('anon','public.crm_save_lead_detail(jsonb)','EXECUTE')
   or has_function_privilege('service_role','public.crm_save_lead_detail(jsonb)','EXECUTE')
   or has_function_privilege('anon','public.crm_lead_details(uuid,text,integer)','EXECUTE') then raise exception 'Privilege boundary leaked'; end if;
end;
$$;
rollback;