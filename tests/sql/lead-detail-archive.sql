-- Generated local fixtures only; including fault injection, everything rolls back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
do $$
declare
 admin uuid:=gen_random_uuid(); sales uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 lead_uuid uuid; room_uuid uuid:=gen_random_uuid(); note_uuid uuid:=gen_random_uuid(); live_uuid uuid:=gen_random_uuid(); request_uuid uuid:=gen_random_uuid();
 create_cmd jsonb; archive_cmd jsonb; result jsonb; denied boolean; baseline bigint; requirement jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (admin,'s15a-'||admin||'@example.test',now()),(sales,'s15a-'||sales||'@example.test',now()),(stranger,'s15a-'||stranger||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values(admin,'super_admin'),(sales,'sales_executive'),(stranger,'sales_executive');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 lead_uuid:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,jsonb_build_object('customer_name','Archive fixture',
   'source_code','manual','priority','normal','inquiry_on','2026-11-07','assigned_user_id',sales))->'lead'->>'id')::uuid;
 create_cmd:=jsonb_build_object('command','save_room','leadId',lead_uuid,'recordId',room_uuid,'requestId',gen_random_uuid(),'version',null,
   'data','{"name":"Preserved room","room_type":null,"sort_order":0,"requirements_notes":"Keep evidence","measurement_notes":null,"deliverables_notes":null}'::jsonb);
 perform public.crm_save_lead_detail(create_cmd);
 perform public.crm_save_lead_detail(jsonb_build_object('command','save_note','leadId',lead_uuid,'recordId',note_uuid,
   'requestId',gen_random_uuid(),'version',null,'data',jsonb_build_object('body','Preserved note')));
 select jsonb_object_agg(k,null::text) into requirement from unnest(array['project_type','property_type','location_description',
   'style_preferences','material_preferences','furniture_preferences','color_preferences','budget_estimate','currency',
   'desired_start_date','desired_completion_date','special_instructions','completion_state']) k;
 perform public.crm_save_lead_detail(jsonb_build_object('command','save_requirements','leadId',lead_uuid,'requestId',gen_random_uuid(),
   'version',null,'data',requirement||'{"currency":"AED","completion_state":"not_started"}'));
 archive_cmd:=jsonb_build_object('requestId',request_uuid,'leadId',lead_uuid,'recordId',room_uuid,'version',1);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_archive_lead_detail(archive_cmd); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Sales acquired archive authority'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_archive_lead_detail(archive_cmd||jsonb_build_object('recordId',lead_uuid)); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Requirements were archived'; end if;
 denied:=false;
 begin perform public.crm_archive_lead_detail(archive_cmd||'{"actorId":"fake"}'); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Archive accepted authority injection'; end if;
 -- Audit failure must roll back archive metadata, version and receipt.
 execute format('alter table crm_sales.detail_events add constraint s15_archive_fault check(action<>''archived'' or record_id<>%L::uuid) not valid',room_uuid);
 select count(*) into baseline from crm_sales.detail_events where lead_id=lead_uuid;
 denied:=false;
 begin perform public.crm_archive_lead_detail(archive_cmd); exception when check_violation then denied:=true; end;
 if not denied or exists(select 1 from crm_sales.detail_records where lead_id=lead_uuid and id=room_uuid and (archived_at is not null or version<>1))
   or exists(select 1 from crm_sales.detail_requests where actor_id=admin and request_id=request_uuid)
   or (select count(*) from crm_sales.detail_events where lead_id=lead_uuid)<>baseline then raise exception 'Archive audit rollback failed'; end if;
 alter table crm_sales.detail_events drop constraint s15_archive_fault;
 result:=public.crm_archive_lead_detail(archive_cmd);
 if result->'record'->>'version'<>'2' or result->'record'->>'archived_at' is null
   or result->'record'->'data' is distinct from create_cmd->'data'
   or result->'record'->>'created_by'<>admin::text then raise exception 'Archive lost original content/author'; end if;
 if public.crm_archive_lead_detail(archive_cmd)->>'replayed'<>'true' then raise exception 'Exact archive retry failed'; end if;
 if (select count(*) from crm_sales.detail_events where lead_id=lead_uuid and action='archived')<>1 then raise exception 'Archive retry duplicated history'; end if;
 denied:=false;
 begin perform public.crm_archive_lead_detail(archive_cmd||jsonb_build_object('recordId',note_uuid)); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Changed input reused archive receipt'; end if;
 if public.crm_lead_details(lead_uuid,'room',0)->>'total'<>'0'
   or public.crm_archived_lead_details(lead_uuid,'room',0)->>'total'<>'1' then raise exception 'Archive views/counts failed'; end if;
 if public.crm_save_lead_detail(create_cmd)->>'replayed'<>'true' then raise exception 'Committed create replay was lost'; end if;
 denied:=false;
 begin perform public.crm_save_lead_detail(create_cmd||jsonb_build_object('requestId',gen_random_uuid(),'version',2));
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Archived detail accepted a new save/no-op request'; end if;
 denied:=false;
 begin perform public.crm_archive_lead_detail(archive_cmd||jsonb_build_object('requestId',gen_random_uuid())); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Already archived detail accepted a new archive'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales,'role','authenticated')::text,true);
 set local role authenticated;
 if public.crm_archived_lead_details(lead_uuid,'room',0)->>'total'<>'1' then raise exception 'Assigned Sales lost archived visibility'; end if;
 denied:=false;
 begin update crm_sales.detail_records set archived_at=null where lead_id=lead_uuid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct archive undo accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',stranger,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_archived_lead_details(lead_uuid,'room',0); exception when insufficient_privilege then denied:=true; end;
 if not denied or exists(select 1 from crm_sales.detail_records where lead_id=lead_uuid)
   or exists(select 1 from crm_sales.detail_events where lead_id=lead_uuid) then raise exception 'Archived records/history leaked'; end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 perform public.crm_archive_lead_detail(archive_cmd||jsonb_build_object('requestId',gen_random_uuid(),'recordId',note_uuid));
 if public.crm_lead_details(lead_uuid,'note',0)->>'total'<>'0'
   or public.crm_archived_lead_details(lead_uuid,'note',0)->'rows'->0->'data'->>'body'<>'Preserved note' then raise exception 'Note archive lost its content'; end if;
 perform public.crm_save_lead_detail(create_cmd||jsonb_build_object('requestId',gen_random_uuid(),'recordId',live_uuid));
 perform public.crm_transition_lead(gen_random_uuid(),lead_uuid,1,'lose','{"reasonCode":"cancelled"}');
 denied:=false;
 begin perform public.crm_archive_lead_detail(archive_cmd||jsonb_build_object('requestId',gen_random_uuid(),'recordId',live_uuid));
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Lost lead child was archived'; end if;
 perform public.crm_transition_lead(gen_random_uuid(),lead_uuid,2,'reopen','{"reason":"Synthetic resumption"}');
 perform public.crm_save_lead(gen_random_uuid(),'archive',lead_uuid,3,'{}');
 denied:=false;
 begin perform public.crm_archive_lead_detail(archive_cmd||jsonb_build_object('requestId',gen_random_uuid(),'recordId',live_uuid));
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Archived lead child was mutated'; end if;
 if has_function_privilege('authenticated','crm_sales.save_lead_detail_v1(jsonb)','EXECUTE')
   or has_function_privilege('authenticated','crm_sales.detail_page(uuid,text,integer,boolean)','EXECUTE')
   or has_function_privilege('anon','public.crm_archive_lead_detail(jsonb)','EXECUTE')
   or has_function_privilege('service_role','public.crm_archive_lead_detail(jsonb)','EXECUTE') then raise exception 'Private execution boundary leaked'; end if;
end;
$$;
rollback;