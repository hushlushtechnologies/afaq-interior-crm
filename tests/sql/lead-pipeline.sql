-- DEC-010 local fixtures. Connection failure also rolls back the transaction.
\set ON_ERROR_STOP on
begin;
set local statement_timeout='30s';
set local lock_timeout='5s';

do $$
declare
 admin_id uuid:=gen_random_uuid();
 sales_id uuid:=gen_random_uuid();
 other_id uuid:=gen_random_uuid();
 pm_id uuid:=gen_random_uuid();
 manager_id uuid:=gen_random_uuid();
 target_lead uuid;
 request_uuid uuid;
 result jsonb;
 data jsonb;
 original_loss jsonb;
 detail jsonb;
 version_number integer:=1;
 stage_name text;
 command jsonb;
 denied boolean;
 event_count bigint;
 loss_count bigint;
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (admin_id,'s14p-'||admin_id||'@example.test',now()),
 (sales_id,'s14p-'||sales_id||'@example.test',now()),
 (other_id,'s14p-'||other_id||'@example.test',now()),
 (pm_id,'s14p-'||pm_id||'@example.test',now()),
 (manager_id,'s14p-'||manager_id||'@example.test',now());

 insert into crm_access.user_roles(user_id,role_key) values
 (admin_id,'super_admin'),
 (sales_id,'sales_executive'),
 (other_id,'sales_executive'),
 (pm_id,'project_manager'),
 (manager_id,'management_director');

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin_id,'role','authenticated')::text,true
 );

 data:=jsonb_build_object(
   'customer_name','DEC-010 Fixture',
   'assigned_user_id',sales_id,
   'source_code','manual',
   'priority','normal',
   'inquiry_on','2026-11-05',
   'initial_note','Preserve original evidence',
   'description','Preserve project information'
 );

 result:=public.crm_save_lead(gen_random_uuid(),'create',null,null,data);
 target_lead:=(result->'lead'->>'id')::uuid;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',sales_id,'role','authenticated')::text,true
 );

 -- All pre-quotation destinations, forward and backward, with original data intact.
 foreach stage_name in array array[
   'assigned','contacted','requirements','site-visit',
   'requirements','contacted','new','site-visit','assigned'
 ] loop
   result:=public.crm_transition_lead(
     gen_random_uuid(),target_lead,version_number,'move',
     jsonb_build_object('stage',stage_name)
   );

   version_number:=(result->'lead'->>'version')::integer;

   if result->'lead'->>'stage'<>stage_name
      or result->'lead'->>'description'<>'Preserve project information'
      or result->'lead'->>'initial_note'<>'Preserve original evidence' then
     raise exception 'Working transition lost data';
   end if;
 end loop;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin_id,'role','authenticated')::text,true
 );

 denied:=false;
 begin
   perform public.crm_save_lead(
     gen_random_uuid(),'assign',target_lead,version_number,
     '{"assigned_user_id":null}'
   );
 exception when invalid_parameter_value then denied:=true;
 end;

 if not denied then
   raise exception 'Assigned stage lost its required owner';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',sales_id,'role','authenticated')::text,true
 );

 select count(*) into event_count
 from crm_sales.events e where e.lead_id=target_lead;

 result:=public.crm_transition_lead(
   gen_random_uuid(),target_lead,version_number,'move','{"stage":"assigned"}'
 );

 if (result->'lead'->>'version')::integer<>version_number
    or (
      select count(*) from crm_sales.events e where e.lead_id=target_lead
    )<>event_count then
   raise exception 'No-op stage fabricated history';
 end if;

 foreach stage_name in array array[
   'quotation-shared','negotiation','won','lost'
 ] loop
   denied:=false;
   begin
     perform public.crm_transition_lead(
       gen_random_uuid(),target_lead,version_number,'move',
       jsonb_build_object('stage',stage_name)
     );
   exception when invalid_parameter_value then denied:=true;
   end;

   if not denied then
     raise exception 'Restricted stage accepted: %',stage_name;
   end if;
 end loop;

 foreach command in array array[
   '{}'::jsonb,
   '{"reasonCode":"fake"}',
   '{"reasonCode":"other"}',
   '{"reasonCode":"other","explanation":"   "}',
   '{"reasonCode":"other","explanation":"\n\t"}',
   '{"reasonCode":"cancelled","note":1}',
   '{"reasonCode":"cancelled","created_by":"fake"}'
 ] loop
   denied:=false;
   begin
     perform public.crm_transition_lead(
       gen_random_uuid(),target_lead,version_number,'lose',command
     );
   exception when invalid_parameter_value then denied:=true;
   end;

   if not denied then
     raise exception 'Invalid Lost details accepted';
   end if;
 end loop;

 request_uuid:=gen_random_uuid();
 command:='{
   "reasonCode":"other",
   "explanation":"Synthetic explanation",
   "note":"Internal evidence"
 }';

 result:=public.crm_transition_lead(
   request_uuid,target_lead,version_number,'lose',command
 );

 version_number:=(result->'lead'->>'version')::integer;

 if result->'lead'->>'stage'<>'lost' then
   raise exception 'Lost failed';
 end if;

 select to_jsonb(x) into original_loss
 from crm_sales.losses x
 where x.id=(result->'lead'->>'current_loss_id')::uuid;

 if original_loss->>'actor_id'<>sales_id::text
    or original_loss->>'explanation'<>'Synthetic explanation'
    or original_loss->>'previous_stage'<>'assigned' then
   raise exception 'Lost evidence missing';
 end if;

 result:=public.crm_transition_lead(
   request_uuid,target_lead,version_number-1,'lose',command
 );

 if result->>'replayed'<>'true'
    or (
      select count(*) from crm_sales.losses x where x.lead_id=target_lead
    )<>1 then
   raise exception 'Lost retry duplicated history';
 end if;

 denied:=false;
 begin
   perform public.crm_transition_lead(
     request_uuid,target_lead,version_number-1,'lose',
     '{"reasonCode":"cancelled"}'
   );
 exception when invalid_parameter_value then denied:=true;
 end;

 if not denied then
   raise exception 'Request input collision accepted';
 end if;

 denied:=false;
 begin
   perform public.crm_save_lead(
     gen_random_uuid(),'update',target_lead,version_number,data
   );
 exception when serialization_failure then denied:=true;
 end;

 if not denied then
   raise exception 'Lost lead edited';
 end if;

 denied:=false;
 begin
   perform public.crm_transition_lead(
     gen_random_uuid(),target_lead,version_number,'move','{"stage":"new"}'
   );
 exception when serialization_failure then denied:=true;
 end;

 if not denied then
   raise exception 'Lost lead moved without reopening';
 end if;

 denied:=false;
 begin
   perform public.crm_transition_lead(
     gen_random_uuid(),target_lead,version_number,'reopen','{"reason":"\n\t"}'
   );
 exception when invalid_parameter_value then denied:=true;
 end;

 if not denied then
   raise exception 'Empty reopening reason accepted';
 end if;

 request_uuid:=gen_random_uuid();

 result:=public.crm_transition_lead(
   request_uuid,target_lead,version_number,'reopen',
   '{"reason":"Client resumed the synthetic inquiry"}'
 );

 version_number:=(result->'lead'->>'version')::integer;

 if result->'lead'->>'stage'<>'assigned'
    or result->'lead'->'current_loss_id'<>'null'::jsonb then
   raise exception 'Last working stage not restored';
 end if;

 if (
   select to_jsonb(x) from crm_sales.losses x
   where x.id=(original_loss->>'id')::uuid
 )<>original_loss then
   raise exception 'Original Lost record overwritten';
 end if;

 result:=public.crm_transition_lead(
   request_uuid,target_lead,version_number-1,'reopen',
   '{"reason":"Client resumed the synthetic inquiry"}'
 );

 if result->>'replayed'<>'true' then
   raise exception 'Reopen retry failed';
 end if;

 denied:=false;
 begin
   perform public.crm_transition_lead(
     gen_random_uuid(),target_lead,version_number-1,'move',
     '{"stage":"contacted"}'
   );
 exception when serialization_failure then denied:=true;
 end;

 if not denied then
   raise exception 'Stale stage request accepted';
 end if;

 result:=public.crm_transition_lead(
   gen_random_uuid(),target_lead,version_number,'lose',
   '{"reasonCode":"budget_too_high"}'
 );

 version_number:=(result->'lead'->>'version')::integer;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin_id,'role','authenticated')::text,true
 );

 denied:=false;
 begin
   perform public.crm_save_lead(
     gen_random_uuid(),'assign',target_lead,version_number,
     jsonb_build_object('assigned_user_id',other_id)
   );
 exception when serialization_failure then denied:=true;
 end;

 if not denied then
   raise exception 'Lost lead reassigned without reopening';
 end if;

 perform public.crm_change_employee_status(
   gen_random_uuid(),sales_id,'active','inactive'
 );

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',sales_id,'role','authenticated')::text,true
 );

 denied:=false;
 begin
   perform public.crm_transition_lead(
     gen_random_uuid(),target_lead,version_number,'reopen',
     '{"reason":"Inactive attempt"}'
   );
 exception when insufficient_privilege then denied:=true;
 end;

 if not denied then
   raise exception 'Inactive actor reopened Lost lead';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin_id,'role','authenticated')::text,true
 );

 result:=public.crm_transition_lead(
   gen_random_uuid(),target_lead,version_number,'reopen',
   '{"reason":"Owner needs replacement"}'
 );

 version_number:=(result->'lead'->>'version')::integer;

 if result->'lead'->>'stage'<>'new' then
   raise exception 'Invalid Assigned restoration did not fall back to New';
 end if;

 denied:=false;
 begin
   perform public.crm_transition_lead(
     gen_random_uuid(),target_lead,version_number,'move','{"stage":"assigned"}'
   );
 exception when invalid_parameter_value then denied:=true;
 end;

 if not denied then
   raise exception 'Inactive owner accepted for Assigned';
 end if;

 result:=public.crm_save_lead(
   gen_random_uuid(),'assign',target_lead,version_number,
   '{"assigned_user_id":null}'
 );

 version_number:=(result->'lead'->>'version')::integer;

 denied:=false;
 begin
   perform public.crm_transition_lead(
     gen_random_uuid(),target_lead,version_number,'move','{"stage":"assigned"}'
   );
 exception when invalid_parameter_value then denied:=true;
 end;

 if not denied then
   raise exception 'Unassigned lead entered Assigned';
 end if;

 detail:=public.crm_pipeline_detail(target_lead);

 if jsonb_array_length(detail->'losses')<>2
    or (
      select count(*) from jsonb_array_elements(detail->'events') e
      where e->>'action'='reopened'
    )<>2
    or (
      select count(*) from jsonb_array_elements(detail->'events') e
      where e->>'action'='lost'
    )<>2 then
   raise exception 'Loss/reopening history missing';
 end if;

 if (select count(*) from crm_sales.lost_reasons)<>11 then
   raise exception 'Approved reason catalog incomplete';
 end if;

 -- A failed audit must roll back the stage/version and retry receipt together.
 select count(*) into event_count
 from crm_sales.events e where e.lead_id=target_lead;

 select count(*) into loss_count
 from crm_sales.losses x where x.lead_id=target_lead;

 alter table crm_sales.events
 add constraint s14_reject_stage check(action<>'stage_changed') not valid;

 request_uuid:=gen_random_uuid();
 denied:=false;

 begin
   perform public.crm_transition_lead(
     request_uuid,target_lead,version_number,'move','{"stage":"contacted"}'
   );
 exception when check_violation then denied:=true;
 end;

 if not denied
    or exists(
      select 1 from crm_sales.requests r
      where r.actor_id=admin_id and r.request_id=request_uuid
    )
    or (
      select l.version from crm_sales.leads l where l.id=target_lead
    )<>version_number
    or (
      select count(*) from crm_sales.events e where e.lead_id=target_lead
    )<>event_count
    or (
      select count(*) from crm_sales.losses x where x.lead_id=target_lead
    )<>loss_count then
   raise exception 'Failed transition escaped transaction';
 end if;

 alter table crm_sales.events drop constraint s14_reject_stage;

 foreach request_uuid in array array[other_id,pm_id,manager_id] loop
   perform set_config(
     'request.jwt.claims',
     jsonb_build_object('sub',request_uuid,'role','authenticated')::text,true
   );

   denied:=false;
   begin
     perform public.crm_transition_lead(
       gen_random_uuid(),target_lead,version_number,'lose',
       '{"reasonCode":"cancelled"}'
     );
   exception when insufficient_privilege then denied:=true;
   end;

   if not denied then
     raise exception 'Unauthorized actor changed outcome';
   end if;
 end loop;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',other_id,'role','authenticated')::text,true
 );

 denied:=false;
 begin
   perform public.crm_pipeline_detail(target_lead);
 exception when insufficient_privilege then denied:=true;
 end;

 if not denied then
   raise exception 'Private pipeline history leaked';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',admin_id,'role','authenticated')::text,true
 );

 result:=public.crm_save_lead(
   gen_random_uuid(),'archive',target_lead,version_number,'{}'
 );

 version_number:=(result->'lead'->>'version')::integer;

 denied:=false;
 begin
   perform public.crm_transition_lead(
     gen_random_uuid(),target_lead,version_number,'move','{"stage":"contacted"}'
   );
 exception when serialization_failure then denied:=true;
 end;

 if not denied then
   raise exception 'Archived lead changed stage';
 end if;

 if has_table_privilege(
      'authenticated','crm_sales.losses','INSERT,UPDATE,DELETE'
    )
    or has_function_privilege(
      'authenticated',
      'crm_sales.crm_save_lead(uuid,text,uuid,integer,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.crm_transition_lead(uuid,uuid,integer,text,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.crm_transition_lead(uuid,uuid,integer,text,jsonb)',
      'EXECUTE'
    ) then
   raise exception 'Private workflow privileges leaked';
 end if;

 perform set_config(
   'request.jwt.claims',
   jsonb_build_object('sub',other_id,'role','authenticated')::text,true
 );
end;
$$;

set local role authenticated;

do $$
declare denied boolean:=false;
begin
 if exists(select 1 from crm_sales.losses) then
   raise exception 'Loss table RLS leaked another owner history';
 end if;

 begin
   update crm_sales.losses set explanation='Tampered evidence';
 exception when insufficient_privilege then denied:=true;
 end;

 if not denied then
   raise exception 'Loss evidence was writable by application role';
 end if;
end;
$$;

reset role;
rollback;