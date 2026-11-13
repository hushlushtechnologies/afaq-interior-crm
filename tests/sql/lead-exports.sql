-- Dedicated local synthetic fixtures. No records survive this transaction.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 m uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); x uuid:=gen_random_uuid(); y uuid:=gen_random_uuid();
 marker text:='export-'||gen_random_uuid(); r jsonb; q jsonb; denied boolean; baseline bigint; i integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (a,'s17-export-'||a||'@example.test',now()),(b,'s17-export-'||b||'@example.test',now()),
 (c,'s17-export-'||c||'@example.test',now()),(m,'s17-export-'||m||'@example.test',now()),(p,'s17-export-'||p||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values
 (a,'super_admin'),(b,'sales_executive'),(c,'sales_executive'),(m,'management_director'),(p,'project_manager');
 insert into crm_sales.leads(id,reference,customer_name,source_code,created_by,assigned_user_id,budget,priority,inquiry_on,description,initial_note)
 overriding system value values(x,9007199254740993,marker||' A','manual',a,b,999999999999.99,'high','2060-01-01','Private description','Private initial note');
 insert into crm_sales.leads(id,customer_name,source_code,created_by,assigned_user_id,priority,inquiry_on) values
 (y,marker||' B','phone',b,c,'urgent','2060-01-02');
 insert into crm_sales.leads(customer_name,source_code,created_by,assigned_user_id,archived_at,inquiry_on)
 values(marker||' Archived','manual',a,b,now(),'2060-01-03');
 q:=jsonb_build_object('search',marker,'page',3,'pageSize',10,'sort','customer_name','direction','asc');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 r:=public.crm_lead_export(q);
 execute 'reset role';
 if jsonb_array_length(r->'rows')<>1 or r->'rows'->0->>0<>'9007199254740993'
 or r->'rows'->0->>12<>'999999999999.99' or jsonb_array_length(r->'rows'->0)<>19
 or r::text like '%Private initial note%' or r::text like '%Private description%' then raise exception 'Scope, precision or field whitelist failed'; end if;
 if not exists(select 1 from crm_sales.export_events e where e.id=(r->>'id')::uuid
 and e.actor_id=b and e.row_count=1 and not e.filters ? 'page' and not e.filters ? 'pageSize') then raise exception 'Snapshot audit failed'; end if;
 r:=public.crm_lead_export(q||'{"archived":true}');
 if jsonb_array_length(r->'rows')<>1 or r->'rows'->0->>18 is null then raise exception 'Archive export failed'; end if;
 r:=public.crm_lead_export(q||'{"source":"phone"}');
 if jsonb_array_length(r->'rows')<>0 then raise exception 'Hidden source leaked'; end if;
 r:=public.crm_lead_export(q||'{"priority":"high","from":"2060-01-01","to":"2060-01-01","stage":"new"}');
 if jsonb_array_length(r->'rows')<>1 then raise exception 'Combined filters failed'; end if;
 -- Reassignment immediately removes a lead from a previously eligible Sales snapshot.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.crm_save_lead(gen_random_uuid(),'assign',x,1,jsonb_build_object('assigned_user_id',c));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 r:=public.crm_lead_export(q);
 if jsonb_array_length(r->'rows')<>0 then raise exception 'Former owner retained export access'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.crm_save_lead(gen_random_uuid(),'assign',x,2,jsonb_build_object('assigned_user_id',b));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 delete from crm_sales.export_events where actor_id=b;
 -- Export and view scopes must intersect, including differing creator/owner identities.
 update crm_access.role_permissions set scope_key='own' where role_key='sales_executive' and permission_key='leads.export';
 r:=public.crm_lead_export(q);
 if jsonb_array_length(r->'rows')<>0 then raise exception 'Export scope widened'; end if;
 update crm_access.role_permissions set scope_key='assigned' where role_key='sales_executive' and permission_key='leads.export';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',m,'role','authenticated')::text,true);
 r:=public.crm_lead_export(q||'{"sort":"priority","direction":"desc"}');
 if jsonb_array_length(r->'rows')<>2 or r->'rows'->0->>8<>'urgent' then raise exception 'Management grant or sorting failed'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.crm_transition_lead(gen_random_uuid(),y,1,'lose','{"reasonCode":"postponed"}');
 r:=public.crm_lead_export(q||'{"stage":"lost"}');
 if jsonb_array_length(r->'rows')<>1 or not exists(select 1 from crm_sales.losses where lead_id=y)
 then raise exception 'Lost export or history preservation failed'; end if;
 -- Audit failure prevents a snapshot response and rolls back its event.
 baseline:=(select count(*) from crm_sales.export_events where actor_id=a);
 alter table crm_sales.export_events add constraint s17_export_fault check(row_count<>1) not valid;
 denied:=false; begin perform public.crm_lead_export(q||'{"stage":"lost"}'); exception when check_violation then denied:=true; end;
 alter table crm_sales.export_events drop constraint s17_export_fault;
 if not denied or (select count(*) from crm_sales.export_events where actor_id=a)<>baseline then raise exception 'Audit failure did not roll back'; end if;
 denied:=false; begin perform public.crm_lead_export(q||'{"actor_id":"forged"}'); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Unexpected query field accepted'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p,'role','authenticated')::text,true);
 denied:=false; begin perform public.crm_lead_export(q); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'View-only role exported'; end if;
 -- More than 1000 rows must fail without an export event, rather than silently truncate.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 insert into crm_sales.leads(customer_name,source_code,created_by,assigned_user_id)
 select marker||' Limit '||n,'manual',b,b from generate_series(1,1001)n;
 baseline:=(select count(*) from crm_sales.export_events where actor_id=b);
 denied:=false; begin perform public.crm_lead_export(jsonb_build_object('search',marker||' Limit')); exception when program_limit_exceeded then denied:=true; end;
 if not denied or (select count(*) from crm_sales.export_events where actor_id=b)<>baseline then raise exception 'Row limit/audit failed'; end if;
 delete from crm_sales.export_events where actor_id=b;
 for i in 1..5 loop perform public.crm_lead_export(jsonb_build_object('search',marker||' Missing')); end loop;
 denied:=false; begin perform public.crm_lead_export(q); exception when raise_exception then denied:=true; end;
 if not denied or (select count(*) from crm_sales.export_events where actor_id=b)<>5 then raise exception 'Export quota failed'; end if;
 -- Permission revocation wins over quota and prevents cached-session exports.
 update auth.users set banned_until=now()+interval '1 hour' where id=b;
 denied:=false; begin perform public.crm_lead_export(q); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Inactive actor exported'; end if;
 update auth.users set banned_until=null where id=b;
 delete from crm_access.user_roles where user_id=b;
 denied:=false; begin perform public.crm_lead_export(q); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Revoked actor exported'; end if;
 if has_function_privilege('anon','public.crm_lead_export(jsonb)','execute')
 or has_function_privilege('service_role','public.crm_lead_export(jsonb)','execute')
 or has_table_privilege('authenticated','crm_sales.export_events','select,insert,update,delete')
 or not (select relrowsecurity from pg_class where oid='crm_sales.export_events'::regclass)
 then raise exception 'Export execution/audit grants or RLS unsafe'; end if;
end;
$$;
rollback;