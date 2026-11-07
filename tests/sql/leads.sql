-- Isolated local synthetic fixtures; all writes, roles and history roll back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';

do $$
<<leads>>
declare
 admin_id uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); pager uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid();
 request_id uuid:=gen_random_uuid(); result jsonb; lead_id uuid; data jsonb; original jsonb; bad boolean; i integer;
 baseline bigint;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (admin_id,'s13-'||admin_id||'@example.test',now()),(a,'s13-'||a||'@example.test',now()),
 (b,'s13-'||b||'@example.test',now()),(pager,'s13-'||pager||'@example.test',now()),(manager,'s13-'||manager||'@example.test',now());

 insert into crm_access.user_roles(user_id,role_key) values
 (admin_id,'super_admin'),(a,'sales_executive'),(b,'sales_executive'),(pager,'sales_executive'),(manager,'management_director');

 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);

 data:=jsonb_build_object('customer_name','SQL Fixture','email','visible-'||a||'@example.test','phone',null,'alternate_phone',null,
 'source_code','manual','assigned_user_id',a,'priority','normal','budget',null,'inquiry_on','2026-11-05',
 'initial_note','Initial evidence','description','Local fixture');

 bad:=false; begin perform public.crm_save_lead(gen_random_uuid(),'create',null,null,data||jsonb_build_object('customer_name',E'\n\t'));
 exception when check_violation then bad:=true; end;
 if not bad then raise exception 'Whitespace-only customer name accepted'; end if;

 result:=public.crm_save_lead(request_id,'create',null,null,data); lead_id:=(result->'lead'->>'id')::uuid;
 original:=result->'lead';

 if result->'lead'->'budget'<>'null'::jsonb then raise exception 'Unknown budget was invented'; end if;

 result:=public.crm_save_lead(request_id,'create',null,null,data);
 if result->>'replayed'<>'true' or (select count(*) from crm_sales.events where crm_sales.events.lead_id=leads.lead_id)<>1 then
   raise exception 'Create retry duplicated effects'; end if;

 bad:=false; begin perform public.crm_save_lead(request_id,'create',null,null,data||'{"customer_name":"Changed"}');
 exception when invalid_parameter_value then bad:=true; end;
 if not bad then raise exception 'Request ID input collision accepted'; end if;

 result:=public.crm_save_lead(gen_random_uuid(),'update',lead_id,1,data||'{"customer_name":"Updated Fixture","budget":"100.50"}');
 if result->'lead'->>'version'<>'2' or result->'lead'->>'source_code'<>'manual'
    or result->'lead'->>'created_at'<>original->>'created_at' or result->'lead'->>'created_by'<>admin_id::text then
   raise exception 'Update changed provenance or version'; end if;

 bad:=false; begin perform public.crm_save_lead(gen_random_uuid(),'update',lead_id,1,data);
 exception when serialization_failure then bad:=true; end;
 if not bad then raise exception 'Stale edit accepted'; end if;

 bad:=false; begin perform public.crm_save_lead(gen_random_uuid(),'update',lead_id,2,data||'{"source_code":"phone"}');
 exception when insufficient_privilege then bad:=true; end;
 if not bad then raise exception 'Source provenance changed'; end if;

 bad:=false; begin perform public.crm_save_lead(gen_random_uuid(),'update',lead_id,2,data||'{"stage":"won"}');
 exception when invalid_parameter_value then bad:=true; end;
 if not bad then raise exception 'Outcome injection accepted'; end if;

 bad:=false; begin perform public.crm_save_lead(gen_random_uuid(),'update',lead_id,2,data||'{"budget":"1.001"}');
 exception when invalid_parameter_value then bad:=true; end;
 if not bad then raise exception 'Budget rounded silently'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager,'role','authenticated')::text,true);
 if (public.crm_lead_page(0,false,lead_id)->>'total')::integer<>1 then raise exception 'Management company visibility failed'; end if;

 bad:=false; begin perform public.crm_save_lead(gen_random_uuid(),'update',lead_id,2,data);
 exception when insufficient_privilege then bad:=true; end;
 if not bad then raise exception 'Management mutation exceeded existing grant'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);

 -- Future trusted ingestion must not insert the same source/external identity twice.
 insert into crm_sales.leads(customer_name,source_code,external_id,created_by)
 values('External Fixture','facebook','synthetic-'||admin_id,admin_id);

 bad:=false; begin
   insert into crm_sales.leads(customer_name,source_code,external_id,created_by)
   values('Repeated External Fixture','facebook','synthetic-'||admin_id,admin_id);
 exception when unique_violation then bad:=true; end;
 if not bad then raise exception 'Repeated external identity accepted'; end if;

 -- A contact match is a warning, not a merge or unique customer identity.
 result:=public.crm_save_lead(gen_random_uuid(),'create',null,null,data);
 if result->>'possibleDuplicate'<>'true' then raise exception 'Duplicate warning missing'; end if;

 perform public.crm_save_lead(gen_random_uuid(),'create',null,null,data||jsonb_build_object('assigned_user_id',b,'email','hidden-'||b||'@example.test'));

 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 if (public.crm_lead_page(0,false,lead_id)->>'total')::integer<>1 then raise exception 'Assigned lead not visible'; end if;
 if jsonb_array_length(public.crm_lead_options()->'owners')<>1 then raise exception 'Owner options exposed other employees'; end if;

 bad:=false; begin perform public.crm_save_lead(gen_random_uuid(),'assign',lead_id,2,jsonb_build_object('assigned_user_id',b));
 exception when insufficient_privilege then bad:=true; end;
 if not bad then raise exception 'Sales reassignment accepted'; end if;

 bad:=false; begin perform public.crm_save_lead(gen_random_uuid(),'archive',lead_id,2,'{}');
 exception when insufficient_privilege then bad:=true; end;
 if not bad then raise exception 'Sales archive accepted'; end if;

 result:=public.crm_save_lead(gen_random_uuid(),'create',null,null,data||jsonb_build_object('assigned_user_id',a,'email','hidden-'||b||'@example.test'));
 if result->>'possibleDuplicate'<>'false' then raise exception 'Duplicate warning leaked inaccessible contact match'; end if;

 perform set_config('test.s13_actor',a::text,true);
 perform set_config('test.s13_lead',lead_id::text,true);

 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 if (public.crm_lead_page(0,false,lead_id)->>'total')::integer<>0 then raise exception 'Cross-owner lead leaked'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 result:=public.crm_save_lead(gen_random_uuid(),'assign',lead_id,2,jsonb_build_object('assigned_user_id',b));
 if result->'lead'->>'assigned_user_id'<>b::text then raise exception 'Assignment failed'; end if;

 if not exists(select 1 from crm_sales.events e where e.lead_id=leads.lead_id and action='assigned' and before_data->>'assigned_user_id'=a::text) then
   raise exception 'Assignment history missing'; end if;

 select count(*) into baseline from crm_sales.events e where e.lead_id=leads.lead_id;
 result:=public.crm_save_lead(gen_random_uuid(),'assign',lead_id,3,jsonb_build_object('assigned_user_id',b));
 if result->'lead'->>'version'<>'3' or (select count(*) from crm_sales.events e where e.lead_id=leads.lead_id)<>baseline then
   raise exception 'No-op assignment fabricated a change'; end if;

 perform public.crm_change_employee_status(gen_random_uuid(),b,'active','inactive');

 bad:=false; begin perform public.crm_save_lead(gen_random_uuid(),'assign',lead_id,3,jsonb_build_object('assigned_user_id',b));
 exception when invalid_parameter_value then bad:=true; end;
 if not bad then raise exception 'Inactive assignee accepted'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 bad:=false; begin perform public.crm_lead_page(0,false,lead_id); exception when insufficient_privilege then bad:=true; end;
 if not bad then raise exception 'Inactive actor read leads'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 select count(*) into baseline from crm_sales.events e where e.lead_id=leads.lead_id;
 request_id:=gen_random_uuid();

 perform public.crm_save_lead(request_id,'archive',lead_id,3,'{}');
 result:=public.crm_save_lead(request_id,'archive',lead_id,3,'{}');
 if result->>'replayed'<>'true' or (select count(*) from crm_sales.events e where e.lead_id=leads.lead_id)<>baseline+1 then
   raise exception 'Archive lost history or duplicated audit'; end if;

 -- Atomic history failure must roll back lead update and retry receipt.
 alter table crm_sales.events add constraint s13_reject_update check(action<>'updated') not valid;
 request_id:=gen_random_uuid();
 result:=public.crm_save_lead(gen_random_uuid(),'create',null,null,data);

 bad:=false; begin perform public.crm_save_lead(request_id,'update',(result->'lead'->>'id')::uuid,1,data||'{"customer_name":"Must Roll Back"}');
 exception when check_violation then bad:=true; end;
 if not bad or exists(select 1 from crm_sales.requests where actor_id=admin_id and crm_sales.requests.request_id=leads.request_id)
 or exists(select 1 from crm_sales.leads where customer_name='Must Roll Back') then raise exception 'Audit failure escaped transaction'; end if;

 alter table crm_sales.events drop constraint s13_reject_update;

 -- Pagination is scoped to a fresh sales identity, independent of existing local rows.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',pager,'role','authenticated')::text,true);
 for i in 1..21 loop
   perform public.crm_save_lead(gen_random_uuid(),'create',null,null,data||jsonb_build_object('assigned_user_id',pager,'email',null));
 end loop;

 if jsonb_array_length(public.crm_lead_page(0,false,null)->'rows')<>20
 or jsonb_array_length(public.crm_lead_page(1,false,null)->'rows')<>1 then raise exception 'Pagination incorrect'; end if;

 if has_table_privilege('authenticated','crm_sales.leads','INSERT,UPDATE,DELETE')
 or has_table_privilege('authenticated','crm_sales.events','INSERT,UPDATE,DELETE')
 or has_table_privilege('authenticated','crm_sales.requests','SELECT,INSERT,UPDATE,DELETE')
 or has_function_privilege('anon','public.crm_save_lead(uuid,text,uuid,integer,jsonb)','EXECUTE')
 or has_function_privilege('service_role','public.crm_save_lead(uuid,text,uuid,integer,jsonb)','EXECUTE') then raise exception 'Private mutation boundary leaked'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end;
$$;

-- Exercise real table RLS as the API role, not as the database owner.
set local role authenticated;

do $$
declare denied boolean:=false;
begin
 if exists(select 1 from crm_sales.leads where assigned_user_id is distinct from auth.uid()) then raise exception 'RLS cross-owner leak'; end if;

 begin update crm_sales.leads set stage='won' where id=current_setting('test.s13_lead')::uuid;
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct UPDATE bypassed controlled commands'; end if;

 if exists(select 1 from crm_sales.events e where not exists(select 1 from crm_sales.leads l where l.id=e.lead_id)) then raise exception 'RLS history leak'; end if;
end;
$$;

reset role;
rollback;