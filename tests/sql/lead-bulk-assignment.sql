-- Local generated fixtures only. Every change rolls back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
do $$
declare
 admin_id uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); manager_id uuid:=gen_random_uuid();
 first_lead uuid; second_lead uuid; foreign_lead uuid; denied boolean; result jsonb; rows jsonb; request_uuid uuid:=gen_random_uuid();
 data jsonb; baseline bigint; failing_lead uuid;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (admin_id,'s14b-'||admin_id||'@example.test',now()),(a,'s14b-'||a||'@example.test',now()),
 (b,'s14b-'||b||'@example.test',now()),(manager_id,'s14b-'||manager_id||'@example.test',now());
 insert into crm_access.user_roles(user_id,role_key) values
 (admin_id,'super_admin'),(a,'sales_executive'),(b,'sales_executive'),(manager_id,'management_director');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 data:=jsonb_build_object('customer_name','Bulk Fixture','assigned_user_id',a,'source_code','manual','priority','normal','inquiry_on','2026-11-05');
 first_lead:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,data)->'lead'->>'id')::uuid;
 second_lead:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,data)->'lead'->>'id')::uuid;
 foreign_lead:=(public.crm_save_lead(gen_random_uuid(),'create',null,null,data)->'lead'->>'id')::uuid;
 rows:=jsonb_build_array(jsonb_build_object('id',first_lead,'version',1),jsonb_build_object('id',second_lead,'version',1));
 result:=public.crm_bulk_assign_leads(request_uuid,rows,b);
 if result->>'affected'<>'2' or result->>'changed'<>'2'
    or (select count(*) from crm_sales.leads where id in (first_lead,second_lead) and assigned_user_id=b and version=2)<>2 then
   raise exception 'Atomic assignment did not change both leads'; end if;
 select count(*) into baseline from crm_sales.events where lead_id in(first_lead,second_lead);
 result:=public.crm_bulk_assign_leads(request_uuid,jsonb_build_array(rows->1,rows->0),b);
 if result->>'replayed'<>'true' or (select count(*) from crm_sales.events where lead_id in(first_lead,second_lead))<>baseline then
   raise exception 'Reordered exact retry duplicated history'; end if;
 denied:=false;
 begin perform public.crm_bulk_assign_leads(request_uuid,rows,a); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Changed owner reused a request ID'; end if;
 rows:=jsonb_build_array(jsonb_build_object('id',first_lead,'version',2),jsonb_build_object('id',second_lead,'version',2));
 result:=public.crm_bulk_assign_leads(gen_random_uuid(),rows,b);
 if result->>'changed'<>'0' or (select count(*) from crm_sales.events where lead_id in(first_lead,second_lead))<>baseline then
   raise exception 'No-op assignment fabricated history'; end if;
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),rows||jsonb_build_array(rows->0),a); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Duplicate selection accepted'; end if;
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),'[{"id":"bad","version":1}]',a); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Invalid selection accepted'; end if;
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),jsonb_build_array(rows->0,jsonb_build_object('id',second_lead,'version',1)),a);
 exception when serialization_failure then denied:=true; end;
 if not denied or exists(select 1 from crm_sales.leads where id in(first_lead,second_lead) and assigned_user_id<>b) then
   raise exception 'Stale selection partially changed ownership'; end if;
 -- Force failure on the later sorted row after the first row mutation succeeds.
 failing_lead:=case when first_lead>second_lead then first_lead else second_lead end;
 execute format('alter table crm_sales.events add constraint s14_bulk_audit_failure check(action<>''assigned'' or lead_id<>%L::uuid) not valid',failing_lead);
 request_uuid:=gen_random_uuid(); denied:=false;
 begin perform public.crm_bulk_assign_leads(request_uuid,rows,a); exception when check_violation then denied:=true; end;
 if not denied or exists(select 1 from crm_sales.leads where id in(first_lead,second_lead) and (version<>2 or assigned_user_id<>b))
    or exists(select 1 from crm_sales.bulk_assignment_requests r where r.request_id=request_uuid and r.actor_id=admin_id)
    or (select count(*) from crm_sales.events where lead_id in(first_lead,second_lead))<>baseline
    or exists(select 1 from crm_sales.requests r where r.actor_id=admin_id and r.request_id in
      (md5('s14-bulk:'||request_uuid::text||':'||first_lead::text)::uuid,md5('s14-bulk:'||request_uuid::text||':'||second_lead::text)::uuid)) then
   raise exception 'Audit failure escaped the batch transaction'; end if;
 alter table crm_sales.events drop constraint s14_bulk_audit_failure;
 result:=public.crm_transition_lead(gen_random_uuid(),second_lead,2,'lose','{"reasonCode":"cancelled"}');
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),jsonb_build_array(rows->0,jsonb_build_object('id',second_lead,'version',3)),a);
 exception when serialization_failure then denied:=true; end;
 if not denied or (select assigned_user_id from crm_sales.leads where id=first_lead)<>b then raise exception 'Lost selection was partially assigned'; end if;
 perform public.crm_transition_lead(gen_random_uuid(),second_lead,3,'reopen','{"reason":"Resume synthetic lead"}');
 perform public.crm_transition_lead(gen_random_uuid(),second_lead,4,'move','{"stage":"assigned"}');
 rows:=jsonb_build_array(jsonb_build_object('id',first_lead,'version',2),jsonb_build_object('id',second_lead,'version',5));
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),rows,null); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Assigned lead was unassigned'; end if;
 perform public.crm_change_employee_status(gen_random_uuid(),a,'active','inactive');
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),rows,a); exception when invalid_parameter_value then denied:=true; end;
 if not denied then raise exception 'Inactive owner accepted'; end if;
 perform public.crm_change_employee_status(gen_random_uuid(),a,'inactive','active');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',manager_id,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),rows,a); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Management exceeded read-only permissions'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),rows,a); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Sales obtained assignment permission'; end if;
 -- Isolated temporary scope grant exercises per-record authorization, then rolls back.
 insert into crm_access.role_permissions(role_key,permission_key,scope_key) values('sales_executive','leads.assign','assigned');
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),jsonb_build_array(rows->0,jsonb_build_object('id',foreign_lead,'version',1)),b);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'One inaccessible record did not reject the selection'; end if;
 delete from crm_access.role_permissions where role_key='sales_executive' and permission_key='leads.assign' and scope_key='assigned';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 perform public.crm_transition_lead(gen_random_uuid(),second_lead,5,'move','{"stage":"new"}');
 rows:=jsonb_build_array(jsonb_build_object('id',first_lead,'version',2),jsonb_build_object('id',second_lead,'version',6));
 result:=public.crm_bulk_assign_leads(gen_random_uuid(),rows,null);
 if result->>'changed'<>'2' or exists(select 1 from crm_sales.leads where id in(first_lead,second_lead) and assigned_user_id is not null) then
   raise exception 'Explicit unassigned state failed'; end if;
 perform public.crm_save_lead(gen_random_uuid(),'archive',first_lead,3,'{}');
 denied:=false;
 begin perform public.crm_bulk_assign_leads(gen_random_uuid(),jsonb_build_array(jsonb_build_object('id',first_lead,'version',4),jsonb_build_object('id',second_lead,'version',7)),b);
 exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Archived selection accepted'; end if;
 if has_table_privilege('authenticated','crm_sales.bulk_assignment_requests','SELECT,INSERT,UPDATE,DELETE')
    or has_function_privilege('anon','public.crm_bulk_assign_leads(uuid,jsonb,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.crm_bulk_assign_leads(uuid,jsonb,uuid)','EXECUTE') then raise exception 'Bulk receipt or execute boundary leaked'; end if;
end;
$$;
rollback;