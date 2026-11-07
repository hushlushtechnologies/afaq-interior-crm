-- Dedicated local fixtures only; all data and role changes roll back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
do $$
declare
 sales_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
 manager_id uuid:=gen_random_uuid(); roleless_id uuid:=gen_random_uuid();
 query jsonb; result jsonb; data jsonb; first_id uuid; last_id uuid; i integer; denied boolean;
 sort_key text; direction text; reference_text text;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (sales_id,'s14-'||sales_id||'@example.test',now()),(other_id,'s14-'||other_id||'@example.test',now()),
 (admin_id,'s14-'||admin_id||'@example.test',now()),(manager_id,'s14-'||manager_id||'@example.test',now()),
 (roleless_id,'s14-'||roleless_id||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values
 (sales_id,'sales_executive'),(other_id,'sales_executive'),(admin_id,'super_admin'),(manager_id,'management_director');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales_id,'role','authenticated')::text,true);
 for i in 1..21 loop
   data:=jsonb_build_object('customer_name','Query Fixture '||lpad(i::text,2,'0'),
     'assigned_user_id',sales_id,'source_code',case when i<=10 then 'phone' else 'manual' end,
     'priority',case when i=21 then 'urgent' else 'normal' end,
     'inquiry_on',case when i<=10 then '2026-11-01' else '2026-11-05' end,
     'email','query-'||sales_id||'@example.test',
     'phone','+971501234567','location',case when i=21 then 'Literal 100%_test' else 'Dubai' end,
     'budget',case when i=21 then null else i::text end);
   result:=public.crm_save_lead(gen_random_uuid(),'create',null,null,data);
   if i=1 then first_id:=(result->'lead'->>'id')::uuid; end if;
   if i=21 then last_id:=(result->'lead'->>'id')::uuid; end if;
 end loop;
 result:=public.crm_query_leads('{}');
 if (result->>'total')::int<>21 or jsonb_array_length(result->'rows')<>20
    or (result->'stageCounts'->>'new')::int<>21 or jsonb_array_length(result->'owners')<>1 then
   raise exception 'Scoped pagination/count/owner contract failed'; end if;
 result:=public.crm_query_leads('{"page":1}');
 if jsonb_array_length(result->'rows')<>1 then raise exception 'Second page failed'; end if;
 result:=public.crm_query_leads('{"pageSize":10,"sort":"customer_name","direction":"asc"}');
 if result->'rows'->0->>'id'<>first_id::text then raise exception 'Ascending server sort failed'; end if;
 result:=public.crm_query_leads('{"sort":"budget","direction":"desc"}');
 if result->'rows'->0->>'budget'<>'20.00' and (result->'rows'->0->>'budget')::numeric<>20 then raise exception 'Budget sort failed'; end if;
 if (public.crm_query_leads('{"search":"100%_test"}')->>'total')::int<>1 then raise exception 'Literal search failed'; end if;
 if (public.crm_query_leads('{"search":"%"}')->>'total')::int<>1 then raise exception 'Wildcard search expanded'; end if;
 if (public.crm_query_leads('{"search":"QUERY FIXTURE 21"}')->>'total')::int<>1 then raise exception 'Case-insensitive name search failed'; end if;
 if (public.crm_query_leads(jsonb_build_object('search','QUERY-'||upper(sales_id::text)||'@EXAMPLE.TEST'))->>'total')::int<>21 then raise exception 'Email search failed'; end if;
 if (public.crm_query_leads('{"search":"+971501234567"}')->>'total')::int<>21 then raise exception 'Phone search failed'; end if;
 select reference::text into reference_text from crm_sales.leads where id=first_id;
 result:=public.crm_query_leads(jsonb_build_object('search',reference_text,'pageSize',50));
 if not exists(select 1 from jsonb_array_elements(result->'rows') r where r->>'id'=first_id::text) then raise exception 'Reference search failed'; end if;
 if (public.crm_query_leads('{"source":"phone","from":"2026-11-01","to":"2026-11-01","priority":"normal"}')->>'total')::int<>10 then raise exception 'Combined inclusive filters failed'; end if;
 if (public.crm_query_leads('{"priority":"urgent"}')->>'total')::int<>1 then raise exception 'Priority filter failed'; end if;
 if (public.crm_query_leads('{"stage":"requirements"}')->>'total')::int<>0 then raise exception 'Stage filter failed'; end if;
 if (public.crm_query_leads('{"owner":"unassigned"}')->>'total')::int<>0 then raise exception 'Assigned-only owner filter failed'; end if;
 if (public.crm_query_leads('{"page":10000}')->>'total')::int<>21 then raise exception 'Empty page lost total'; end if;
 foreach sort_key in array array['created_at','customer_name','reference','budget','inquiry_on','follow_up_on','priority','stage','owner','source_code'] loop
   foreach direction in array array['asc','desc'] loop
     result:=public.crm_query_leads(jsonb_build_object('sort',sort_key,'direction',direction,'pageSize',50));
     if jsonb_array_length(result->'rows')<>21 then raise exception 'Sort contract failed: % %',sort_key,direction; end if;
   end loop;
 end loop;
 foreach query in array array[
   '{"page":-1}'::jsonb,'{"page":1.5}','{"pageSize":1000}','{"archived":"false"}',
   '{"from":"2026-02-30"}','{"from":"2026-11-06","to":"2026-11-05"}',
   '{"stage":"approved"}','{"owner":"someone"}','{"sort":"password"}',
   '{"direction":"desc;drop table"}','{"company":"other"}','{"search":1}'
 ] loop
   denied:=false;
   begin perform public.crm_query_leads(query); exception when invalid_parameter_value then denied:=true; end;
   if not denied then raise exception 'Invalid query accepted: %',query; end if;
 end loop;
 perform public.crm_transition_lead(gen_random_uuid(),last_id,1,'move','{"stage":"requirements"}');
 result:=public.crm_query_leads('{"sort":"customer_name","direction":"asc","pageSize":10}');
 if (result->'stageCounts'->>'requirements')::integer<>1 or (result->'stageCounts'->>'new')::integer<>20
    or exists(select 1 from jsonb_array_elements(result->'rows') r where r->>'stage'='requirements') then
   raise exception 'Pipeline counts were limited to the loaded page'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated')::text,true);
 result:=public.crm_query_leads(jsonb_build_object('search','query-'||sales_id||'@example.test','owner',sales_id));
 if (result->>'total')::int<>0 or jsonb_array_length(result->'owners')<>0 or jsonb_array_length(result->'sources')<>0 or result->'stageCounts'<>'{}'::jsonb then
   raise exception 'Hidden records, counts or owner options leaked'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 result:=public.crm_save_lead(gen_random_uuid(),'create',null,null,
   data||jsonb_build_object('assigned_user_id',null,'customer_name','Unassigned '||admin_id));
 if (public.crm_query_leads(jsonb_build_object('owner','unassigned','search',admin_id))->>'total')::int<>1 then raise exception 'Company unassigned filter failed'; end if;
 perform public.crm_save_lead(gen_random_uuid(),'archive',first_id,1,'{}');
 result:=public.crm_query_leads(jsonb_build_object('owner',sales_id,'archived',true));
 if (result->>'total')::int<>1 then raise exception 'Archive filter failed'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager_id,'role','authenticated')::text,true);
 if (public.crm_query_leads(jsonb_build_object('owner',sales_id))->>'total')::int<>20 then raise exception 'Management read scope failed'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',roleless_id,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_query_leads('{}'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Roleless query accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 perform public.crm_change_employee_status(gen_random_uuid(),sales_id,'active','inactive');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',sales_id,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_query_leads('{}'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Inactive query accepted'; end if;
 if has_function_privilege('anon','public.crm_query_leads(jsonb)','EXECUTE')
    or has_function_privilege('service_role','public.crm_query_leads(jsonb)','EXECUTE') then
   raise exception 'Query execute boundary leaked'; end if;
end;
$$;
rollback;