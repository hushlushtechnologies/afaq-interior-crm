-- Run manually in the trusted SQL Editor of staging project mjdkunkdtzlzoorwrfou.
-- First create and confirm exactly one intended staging Auth account.
-- This is setup SQL, not a migration or an application endpoint.
begin;

do $bootstrap$
declare
  account auth.users%rowtype;
  account_count bigint;
begin
  perform pg_advisory_xact_lock(90310001::bigint);

  select count(*) into account_count
  from auth.users
  where deleted_at is null;

  if account_count<>1 then
    raise exception
      'Expected exactly one staging Auth account; found %. Stop and review.',
      account_count;
  end if;

  select * into strict account
  from auth.users
  where deleted_at is null
  for update;

  if crm_access.is_eligible_user(account.id) is not true then
    raise exception
      'The staging account must be email-confirmed, eligible and active.';
  end if;

  insert into crm_employees.employees(
    auth_user_id,
    display_name,
    work_email,
    employment_status
  )
  values(
    account.id,
    left(
      coalesce(
        nullif(btrim(account.raw_user_meta_data->>'full_name'),''),
        account.email
      ),
      160
    ),
    lower(account.email),
    'active'
  )
  on conflict(auth_user_id) do nothing;

  -- Transaction-local context for the existing privileged bootstrap RPC.
  -- Run only from the trusted staging SQL Editor.
  perform set_config(
    'request.jwt.claim.role',
    'service_role',
    true
  );

  perform set_config(
    'request.jwt.claims',
    '{"role":"service_role"}',
    true
  );

  perform public.crm_bootstrap_super_admin(account.id);

  if not exists(
    select 1
    from crm_access.user_roles
    where user_id=account.id
      and role_key='super_admin'
  ) or crm_access.is_eligible_user(account.id) is not true then
    raise exception
      'Staging Super Admin verification failed.';
  end if;
end;
$bootstrap$;

commit;

select
  membership.role_key,
  employee.employment_status,
  account.email_confirmed_at is not null as email_confirmed,
  crm_access.is_eligible_user(account.id) as eligible,
  exists(
    select 1
    from crm_access.role_events event
    where event.target_user_id=account.id
      and event.role_key='super_admin'
      and event.action='role_assigned'
  ) as role_audit_recorded
from crm_access.user_roles membership
join auth.users account
  on account.id=membership.user_id
join crm_employees.employees employee
  on employee.auth_user_id=account.id
where membership.role_key='super_admin';