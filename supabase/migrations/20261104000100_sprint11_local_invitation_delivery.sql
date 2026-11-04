alter table crm_employees.invitations
  drop constraint invitations_status_check;

alter table crm_employees.invitations
  add constraint invitations_status_check check (
    status in (
      'pending_delivery',
      'delivering',
      'delivery_uncertain',
      'delivered',
      'accepted'
    )
  ),
  add column delivery_attempt uuid,
  add column delivery_started_at timestamptz,
  add column auth_user_id uuid unique references auth.users(id),
  add column accepted_at timestamptz;

create table crm_employees.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id),
  display_name text not null,
  work_email text not null unique,
  employment_status text not null default 'invited'
    check (employment_status in ('invited', 'active', 'inactive')),
  created_at timestamptz not null default now()
);

alter table crm_employees.employees enable row level security;

revoke all on crm_employees.employees
  from public, anon, authenticated, service_role;

create function public.crm_claim_local_employee_invitation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v crm_employees.invitations%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(90310001::bigint);

  if crm_access.is_super_admin(auth.uid()) is not true
     or public.crm_has_permission('access.roles.manage', 'company') is not true then
    raise exception using
      errcode = '42501',
      message = 'Super Admin required.';
  end if;

  select * into v
  from crm_employees.invitations
  where id = p_id
  for update;

  if not found or v.work_email !~ '@example[.]test$' then
    raise exception using
      errcode = '22023',
      message = 'Local test invitation required.';
  end if;

  if v.status = 'pending_delivery' then
    if exists (
      select 1
      from auth.users
      where lower(email) = v.work_email
    ) then
      return jsonb_build_object('status', 'account_exists');
    end if;

    update crm_employees.invitations
    set
      status = 'delivering',
      delivery_attempt = gen_random_uuid(),
      delivery_started_at = now()
    where id = p_id
    returning * into v;

    return jsonb_build_object(
      'status', 'send',
      'attemptId', v.delivery_attempt,
      'email', v.work_email
    );
  end if;

  if v.status in ('delivered', 'accepted') then
    return jsonb_build_object('status', v.status);
  end if;

  if v.status = 'delivering'
     and v.delivery_started_at > now() - interval '60 seconds' then
    return jsonb_build_object('status', 'busy');
  end if;

  update crm_employees.invitations
  set status = 'delivery_uncertain'
  where id = p_id;

  return jsonb_build_object(
    'status', 'check',
    'attemptId', v.delivery_attempt
  );
end;
$$;

create function public.crm_reconcile_local_employee_invitation(
  p_id uuid,
  p_attempt uuid,
  p_confirmed boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v crm_employees.invitations%rowtype;
  v_user uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Service execution required.';
  end if;

  select * into v
  from crm_employees.invitations
  where id = p_id
  for update;

  if not found
     or v.delivery_attempt is distinct from p_attempt
     or p_attempt is null then
    raise exception using
      errcode = '22023',
      message = 'Delivery attempt mismatch.';
  end if;

  if v.status in ('delivered', 'accepted') then
    return v.status;
  end if;

  select id into v_user
  from auth.users
  where lower(email) = v.work_email
    and invited_at >= v.delivery_started_at
    and deleted_at is null
  limit 1;

  if v_user is null then
    update crm_employees.invitations
    set status = 'delivery_uncertain'
    where id = p_id;

    return 'delivery_uncertain';
  end if;

  update crm_employees.invitations
  set
    status = case
      when p_confirmed then 'delivered'
      else 'delivery_uncertain'
    end,
    auth_user_id = v_user
  where id = p_id;

  return case
    when p_confirmed then 'delivered'
    else 'delivery_uncertain'
  end;
end;
$$;

create function public.crm_get_my_employee_invitation()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when invitation.status = 'delivery_uncertain' then 'delivered'
      else invitation.status
    end
  from crm_employees.invitations invitation
  where invitation.auth_user_id = auth.uid()
    and invitation.status in ('delivered', 'delivery_uncertain', 'accepted')
    and crm_access.is_eligible_user(auth.uid());
$$;

create function public.crm_accept_employee_invitation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v crm_employees.invitations%rowtype;
begin
  select * into v
  from crm_employees.invitations
  where auth_user_id = auth.uid()
  for update;

  if not found
     or v.status not in ('delivered', 'delivery_uncertain', 'accepted')
     or crm_access.is_eligible_user(auth.uid()) is not true
     or not exists (
       select 1
       from auth.users
       where id = auth.uid()
         and coalesce(encrypted_password, '') <> ''
     ) then
    raise exception using
      errcode = '42501',
      message = 'Verified invitation and password required.';
  end if;

  if v.status = 'accepted' then
    return;
  end if;

  insert into crm_employees.employees (
    auth_user_id,
    display_name,
    work_email,
    employment_status
  )
  values (
    auth.uid(),
    v.display_name,
    v.work_email,
    'active'
  );

  update crm_employees.invitations
  set
    status = 'accepted',
    accepted_at = now()
  where id = v.id;
end;
$$;

revoke all on function public.crm_claim_local_employee_invitation(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.crm_reconcile_local_employee_invitation(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;

revoke all on function public.crm_get_my_employee_invitation()
  from public, anon, authenticated, service_role;

revoke all on function public.crm_accept_employee_invitation()
  from public, anon, authenticated, service_role;

grant execute on function public.crm_claim_local_employee_invitation(uuid)
  to authenticated;

grant execute on function public.crm_reconcile_local_employee_invitation(uuid, uuid, boolean)
  to service_role;

grant execute on function public.crm_get_my_employee_invitation()
  to authenticated;

grant execute on function public.crm_accept_employee_invitation()
  to authenticated;

notify pgrst, 'reload schema';