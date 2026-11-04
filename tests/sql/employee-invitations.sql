-- Dedicated local database only. All fixtures and invitation writes roll back.
\set ON_ERROR_STOP on

BEGIN;

SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';

DO $$
declare
  actor uuid := gen_random_uuid();
  sales uuid := gen_random_uuid();
  target uuid := gen_random_uuid();
  key uuid := gen_random_uuid();
  v_email text := 's11-' || gen_random_uuid()::text || '@example.test';
  first_result jsonb;
  next_result jsonb;
  rejected boolean;
  before_roles bigint;
begin
  insert into auth.users(id, email, email_confirmed_at)
  values
    (actor, 's11-admin-' || actor::text || '@example.test', now()),
    (sales, 's11-sales-' || sales::text || '@example.test', now()),
    (target, 's11-existing-' || target::text || '@example.test', now());

  insert into crm_access.user_roles(user_id, role_key)
  values
    (actor, 'super_admin'),
    (sales, 'sales_executive');

  select count(*) into before_roles
  from crm_access.user_roles;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', sales, 'role', 'authenticated')::text,
    true
  );

  rejected := false;

  begin
    perform public.crm_request_employee_invitation(
      key,
      'Example Employee',
      v_email
    );
  exception when insufficient_privilege then
    rejected := true;
  end;

  if not rejected then
    raise exception 'FAIL: Sales invitation request accepted';
  end if;

  raise notice 'PASS: Sales invitation request rejected';

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor, 'role', 'authenticated')::text,
    true
  );

  first_result := public.crm_request_employee_invitation(
    key,
    'Example Employee',
    upper(v_email)
  );

  if first_result->>'status' <> 'queued' then
    raise exception 'FAIL: invitation not queued';
  end if;

  next_result := public.crm_request_employee_invitation(
    key,
    'Example Employee',
    v_email
  );

  if next_result is distinct from first_result then
    raise exception 'FAIL: retry response changed';
  end if;

  raise notice 'PASS: normalized email and exact retry return the same invitation';

  next_result := public.crm_request_employee_invitation(
    gen_random_uuid(),
    'Different Name',
    v_email
  );

  if next_result->>'status' <> 'already_pending'
     or next_result->>'invitationId' <> first_result->>'invitationId' then
    raise exception 'FAIL: duplicate email created a second invitation';
  end if;

  if (
    select display_name
    from crm_employees.invitations
    where work_email = v_email
  ) <> 'Example Employee' then
    raise exception 'FAIL: duplicate request overwrote the original employee name';
  end if;

  raise notice 'PASS: duplicate email preserves original invitation and name';

  rejected := false;

  begin
    perform public.crm_request_employee_invitation(
      key,
      'Changed Name',
      v_email
    );
  exception when invalid_parameter_value then
    rejected := true;
  end;

  if not rejected then
    raise exception 'FAIL: changed input reused a request ID';
  end if;

  raise notice 'PASS: request ID reuse with changed input rejected';

  next_result := public.crm_request_employee_invitation(
    gen_random_uuid(),
    'Existing Account',
    's11-existing-' || target::text || '@example.test'
  );

  if next_result->>'status' <> 'account_exists'
     or next_result->>'invitationId' is not null then
    raise exception 'FAIL: existing authentication account received an invitation';
  end if;

  raise notice 'PASS: existing Auth account creates no invitation';

  rejected := false;

  begin
    perform public.crm_request_employee_invitation(
      gen_random_uuid(),
      E'Example\nEmployee',
      v_email
    );
  exception when invalid_parameter_value then
    rejected := true;
  end;

  if not rejected then
    raise exception 'FAIL: invalid direct RPC input accepted';
  end if;

  raise notice 'PASS: database rejects invalid direct RPC input';

  -- Permissions are checked even when replaying a successful request.
  delete from crm_access.user_roles
  where user_id = actor
    and role_key = 'super_admin';

  rejected := false;

  begin
    perform public.crm_request_employee_invitation(
      key,
      'Example Employee',
      v_email
    );
  exception when insufficient_privilege then
    rejected := true;
  end;

  if not rejected then
    raise exception 'FAIL: revoked authority replayed an invitation';
  end if;

  insert into crm_access.user_roles(user_id, role_key)
  values (actor, 'super_admin');

  raise notice 'PASS: revoked Super Admin cannot replay an earlier request';

  if (
    select count(*)
    from crm_access.user_roles
  ) <> before_roles then
    raise exception 'FAIL: role membership changed';
  end if;

  if exists (
    select 1
    from auth.users
    where lower(auth.users.email) = v_email
  ) then
    raise exception 'FAIL: invitation request created an Auth account';
  end if;

  if (
    select count(*)
    from crm_employees.invitations
    where work_email = v_email
  ) <> 1 then
    raise exception 'FAIL: wrong invitation count';
  end if;

  if has_function_privilege(
    'anon',
    'public.crm_request_employee_invitation(uuid,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.crm_request_employee_invitation(uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: non-session caller can execute the invitation RPC';
  end if;

  if has_table_privilege(
    'authenticated',
    'crm_employees.invitations',
    'INSERT'
  ) or has_table_privilege(
    'authenticated',
    'crm_employees.invitation_receipts',
    'UPDATE'
  ) then
    raise exception 'FAIL: direct table writes are granted';
  end if;

  raise notice 'PASS: roles preserved, no Auth account created, private tables and RPC grants restricted';
end;
$$;

ROLLBACK;