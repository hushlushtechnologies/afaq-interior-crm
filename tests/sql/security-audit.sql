-- Dedicated local fixtures only. All history, accounts and constraints roll back.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='5s';
DO $$
declare
  actor uuid:=gen_random_uuid(); anchor uuid:=gen_random_uuid(); target uuid:=gen_random_uuid();
  rejected boolean; baseline bigint; response jsonb; i integer;
  status_target uuid:=gen_random_uuid(); invitation jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (actor,'s12-audit-'||actor||'@example.test',now()),
    (anchor,'s12-audit-'||anchor||'@example.test',now()),
    (target,'s12-audit-'||target||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values
    (actor,'super_admin'),(anchor,'super_admin'),(target,'sales_executive');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  perform public.crm_assign_user_role(target,'finance_officer');
  perform public.crm_assign_user_role(target,'finance_officer');
  perform public.crm_revoke_user_role(target,'finance_officer');
  perform public.crm_revoke_user_role(target,'finance_officer');
  if (select count(*) from crm_access.role_events where target_user_id=target and role_key='finance_officer')<>2 then
    raise exception 'Duplicate or missing role events';
  end if;
  if (select count(*) from crm_access.role_events where target_user_id=target and role_key='finance_officer'
      and actor_id=actor and actor_kind='employee')<>2 then raise exception 'Human attribution mismatch'; end if;
  if not exists(select 1 from crm_access.user_roles where user_id=target and role_key='sales_executive') then
    raise exception 'Unrelated role was changed'; end if;

  -- A failed audit insert must roll back the role mutation itself.
  alter table crm_access.role_events add constraint s12_audit_failure check(role_key<>'finance_officer') not valid;
  rejected:=false;
  begin perform public.crm_assign_user_role(target,'finance_officer');
  exception when check_violation then rejected:=true; end;
  if not rejected or exists(select 1 from crm_access.user_roles where user_id=target and role_key='finance_officer') then
    raise exception 'Role change escaped failed audit transaction'; end if;
  alter table crm_access.role_events drop constraint s12_audit_failure;

  rejected:=false;
  begin update crm_access.user_roles set role_key='management_director' where user_id=actor and role_key='super_admin';
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'Membership identity reassigned'; end if;

  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  perform public.crm_assign_user_role(target,'finance_officer');
  perform public.crm_revoke_user_role(target,'finance_officer');
  if (select count(*) from crm_access.role_events where target_user_id=target and actor_kind='trusted_service' and actor_id is null)<>2 then
    raise exception 'Service actor attribution mismatch'; end if;

  -- Forged metadata does not supply database roles or audit-read authorization.
  update auth.users set raw_user_meta_data='{"role":"super_admin","roles":["super_admin"]}' where id=target;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',target,'role','authenticated')::text,true);
  select count(*) into baseline from crm_access.role_events;
  rejected:=false;
  begin perform public.crm_assign_user_role(target,'super_admin'); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Metadata escalated access'; end if;
  rejected:=false;
  begin perform public.crm_get_security_audit(0,null); exception when insufficient_privilege then rejected:=true; end;
  if not rejected or (select count(*) from crm_access.role_events)<>baseline then raise exception 'Unauthorized audit read or false success event'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  insert into auth.users(id,email,email_confirmed_at) values
    (status_target,'s12-audit-'||status_target||'@example.test',now());
  perform public.crm_change_employee_status(gen_random_uuid(),status_target,'active','inactive');
  response:=public.crm_get_security_audit(0,status_target);
  if jsonb_array_length(response->'events')<>1 or response->'events'->0->>'source'<>'employee_status' then
    raise exception 'Account-status audit missing'; end if;
  invitation:=public.crm_request_employee_invitation(gen_random_uuid(),'Audit Fixture','s12-invite-'||gen_random_uuid()||'@example.test');
  response:=public.crm_get_security_audit(0,(invitation->>'invitationId')::uuid);
  if jsonb_array_length(response->'events')<>1 or response->'events'->0->>'source'<>'invitations' then
    raise exception 'Invitation lifecycle audit missing'; end if;
  -- Synthetic pagination evidence exists only inside this rollback transaction.
  for i in 1..30 loop
    insert into crm_access.role_events(actor_id,actor_kind,target_user_id,action,role_key)
    values(actor,'employee',target,'role_assigned','sales_executive');
  end loop;
  response:=public.crm_get_security_audit(0,target);
  if jsonb_array_length(response->'events')<>25 or (response->>'hasMore')::boolean is not true then
    raise exception 'First audit page incorrect'; end if;
  response:=public.crm_get_security_audit(1,target);
  if jsonb_array_length(response->'events')<>10 or (response->>'hasMore')::boolean is not false then
    raise exception 'Second audit page incorrect'; end if;
  if exists(select 1 from jsonb_array_elements(response->'events') e where e->>'targetId'<>target::text) then
    raise exception 'Target filter leaked records'; end if;
  rejected:=false;
  begin perform public.crm_get_security_audit(-1,null); exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'Invalid page accepted'; end if;

  perform public.crm_revoke_user_role(actor,'super_admin');
  rejected:=false;
  begin perform public.crm_get_security_audit(0,target); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Revoked actor retained audit access'; end if;

  perform set_config('request.jwt.claims','{}',true);
  delete from auth.users where id=target;
  if (select count(*) from crm_access.role_events where target_user_id=target)<>36 then
    raise exception 'Auth deletion erased history or missed role cascade'; end if;
  if has_table_privilege('authenticated','crm_access.role_events','SELECT,INSERT,UPDATE,DELETE') or
     has_table_privilege('service_role','crm_access.role_events','SELECT,INSERT,UPDATE,DELETE') or
     has_function_privilege('anon','public.crm_get_security_audit(integer,uuid)','EXECUTE') or
     has_function_privilege('service_role','public.crm_get_security_audit(integer,uuid)','EXECUTE') then
    raise exception 'Audit privileges leaked'; end if;
end;
$$;
ROLLBACK;