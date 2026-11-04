-- Dedicated local database only. Every fixture and change is rolled back.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';
SAVEPOINT final_admin_fixture;
DO $$
declare actor uuid := gen_random_uuid(); rejected boolean := false;
begin
  perform pg_advisory_xact_lock(90310001::bigint);
  insert into auth.users(id,email,email_confirmed_at)
    values(actor,'s11-status-'||actor::text||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values(actor,'super_admin');
  -- Isolate the fixture as final admin inside this savepoint only.
  delete from crm_access.user_roles where role_key='super_admin' and user_id<>actor;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  begin
    perform public.crm_change_employee_status(gen_random_uuid(),actor,'active','inactive');
  exception when check_violation then rejected:=true;
  end;
  if not rejected or not crm_access.is_eligible_user(actor) then
    raise exception 'FAIL: final eligible Super Admin was deactivated';
  end if;
  if exists(select 1 from crm_employees.account_status_events where target_user_id=actor) then
    raise exception 'FAIL: rejected status change produced an audit event';
  end if;
  raise notice 'PASS: final eligible Super Admin protected; rejected write left no audit event';
end;
$$;
ROLLBACK TO SAVEPOINT final_admin_fixture;
RELEASE SAVEPOINT final_admin_fixture;

DO $$
declare actor uuid:=gen_random_uuid(); target uuid:=gen_random_uuid(); pending uuid:=gen_random_uuid();
  key uuid:=gen_random_uuid(); rejected boolean; answer jsonb; i integer;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (actor,'s11-status-'||actor::text||'@example.test',now()),
    (target,'s11-status-'||target::text||'@example.test',now()),
    (pending,'s11-status-'||pending::text||'@example.test',now());
  insert into crm_access.user_roles(user_id,role_key) values
    (actor,'super_admin'),(target,'sales_executive'),(target,'finance_officer'),(pending,'sales_executive');
  insert into crm_employees.employees(auth_user_id,display_name,work_email,employment_status,created_at)
    values(target,'Original Employee','s11-status-'||target::text||'@example.test','active','2000-01-01');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  perform public.crm_change_employee_status(key,target,'active','inactive');
  answer:=public.crm_change_employee_status(key,target,'active','inactive');
  if answer->>'replayed'<>'true' or crm_access.is_eligible_user(target) then
    raise exception 'FAIL: deactivation or exact replay failed';
  end if;
  if (select count(*) from crm_employees.account_status_events where target_user_id=target)<>1
    or not exists(select 1 from crm_employees.account_status_events where request_id=key and actor_id=actor) then
    raise exception 'FAIL: audit event missing or duplicated';
  end if;
  if (select count(*) from crm_access.user_roles where user_id=target)<>2 then
    raise exception 'FAIL: deactivation removed existing roles';
  end if;
  raise notice 'PASS: deactivation blocks eligibility, preserves roles, and audits once';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',target,'role','authenticated')::text,true);
  if public.crm_has_permission('finance.view','company') then raise exception 'FAIL: inactive permissions survived'; end if;
  rejected:=false;
  begin perform public.crm_employee_directory('',0);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL: inactive account read directory'; end if;
  raise notice 'PASS: inactive direct permissions and directory access denied';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  perform public.crm_change_employee_status(gen_random_uuid(),target,'inactive','active');
  answer:=public.crm_change_employee_status(key,target,'active','inactive');
  if answer->>'status'<>'active' or not crm_access.is_eligible_user(target) then
    raise exception 'FAIL: an old retry reversed a later activation';
  end if;
  if (select count(*) from crm_employees.account_status_events where target_user_id=target)<>2 then
    raise exception 'FAIL: replay added an audit event';
  end if;
  if not exists(select 1 from crm_employees.employees where auth_user_id=target
    and display_name='Original Employee' and created_at='2000-01-01'::timestamptz and deactivated_at is null) then
    raise exception 'FAIL: activation replaced historical profile fields';
  end if;
  raise notice 'PASS: activation restores eligibility; old retries preserve current state and history';

  rejected:=false;
  begin perform public.crm_change_employee_status(gen_random_uuid(),target,'inactive','active');
  exception when serialization_failure then rejected:=true; end;
  if not rejected then raise exception 'FAIL: stale state overwrote current state'; end if;
  rejected:=false;
  begin perform public.crm_change_employee_status(key,target,'inactive','active');
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'FAIL: changed payload reused a request ID'; end if;
  raise notice 'PASS: stale writes and conflicting request IDs rejected';

  insert into crm_employees.invitations(display_name,work_email,requested_by,status,auth_user_id)
    values('Pending Employee','s11-status-'||pending::text||'@example.test',actor,'delivered',pending);
  if crm_access.is_eligible_user(pending) then raise exception 'FAIL: incomplete invitation grants business eligibility'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',pending,'role','authenticated')::text,true);
  if public.crm_get_my_employee_status()<>'invited' or public.crm_get_my_employee_invitation()<>'delivered' then
    raise exception 'FAIL: invitation completion path blocked';
  end if;
  raise notice 'PASS: incomplete invitations block business access while preserving acceptance';
  update crm_employees.invitations set auth_user_id=null where auth_user_id=pending;
  if crm_access.is_eligible_user(pending) or public.crm_get_my_employee_status()<>'invited' then
    raise exception 'FAIL: an unreconciled invitation bypassed onboarding';
  end if;
  raise notice 'PASS: unreconciled invitations remain blocked by normalized email';

  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  for i in 1..21 loop
    insert into auth.users(id,email,email_confirmed_at)
      values(gen_random_uuid(),'s11-page-'||actor::text||'-'||i::text||'@example.test',now());
  end loop;
  answer:=public.crm_employee_directory('s11-page-'||actor::text,0);
  if (answer->>'total')::integer<>21 or jsonb_array_length(answer->'rows')<>20 then
    raise exception 'FAIL: first directory page is not bounded';
  end if;
  answer:=public.crm_employee_directory('s11-page-'||actor::text,1);
  if jsonb_array_length(answer->'rows')<>1 then raise exception 'FAIL: second directory page is incorrect'; end if;
  raise notice 'PASS: directory search and bounded pagination verified';

  if has_function_privilege('anon','public.crm_change_employee_status(uuid,uuid,text,text)','EXECUTE')
    or has_table_privilege('authenticated','crm_employees.account_status_events','UPDATE') then
    raise exception 'FAIL: inappropriate mutation privileges';
  end if;
  raise notice 'PASS: anonymous status mutation and direct audit updates not granted';
end;
$$;
ROLLBACK;
