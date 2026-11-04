create schema crm_employees;

create table crm_employees.invitations (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  work_email text not null unique,
  status text not null default 'pending_delivery'
    check (status = 'pending_delivery'),
  requested_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table crm_employees.invitation_receipts (
  request_id uuid primary key,
  requested_by uuid not null references auth.users(id),
  display_name text not null,
  work_email text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table crm_employees.invitations enable row level security;
alter table crm_employees.invitation_receipts enable row level security;

revoke all on schema crm_employees from public, anon, authenticated, service_role;

revoke all on all tables in schema crm_employees
  from public, anon, authenticated, service_role;

alter default privileges in schema crm_employees revoke all on tables
  from public, anon, authenticated, service_role;

alter default privileges in schema crm_employees revoke execute on functions
  from public, anon, authenticated, service_role;

create function public.crm_request_employee_invitation(
  p_request_id uuid,
  p_display_name text,
  p_work_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := pg_catalog.btrim(p_display_name);
  v_email text := pg_catalog.lower(pg_catalog.btrim(p_work_email));
  v_previous crm_employees.invitation_receipts%rowtype;
  v_invitation_id uuid;
  v_result jsonb;
begin
  -- Share the role-change lock, then check current authority, including on retries.
  perform pg_catalog.pg_advisory_xact_lock(90310001::bigint);

  if crm_access.is_super_admin(v_actor) is not true
     or public.crm_has_permission('access.roles.manage', 'company') is not true then
    raise exception using
      errcode = '42501',
      message = 'Super Admin authority is required.';
  end if;

  if p_request_id is null or v_name is null
     or pg_catalog.length(v_name) not between 1 and 120
     or v_name ~ '[[:cntrl:]]'
     or v_email is null or pg_catalog.length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception using
      errcode = '22023',
      message = 'Invalid invitation input.';
  end if;

  select * into v_previous
  from crm_employees.invitation_receipts
  where request_id = p_request_id;

  if found then
    if v_previous.requested_by <> v_actor then
      raise exception using
        errcode = '42501',
        message = 'Request ID is unavailable.';
    end if;

    if v_previous.display_name <> v_name
       or v_previous.work_email <> v_email then
      raise exception using
        errcode = '22023',
        message = 'Request ID was used for different input.';
    end if;

    return v_previous.result;
  end if;

  if exists (
    select 1
    from auth.users
    where pg_catalog.lower(email) = v_email
  ) then
    v_result := pg_catalog.jsonb_build_object(
      'status', 'account_exists',
      'invitationId', null,
      'workEmail', v_email
    );
  else
    select id into v_invitation_id
    from crm_employees.invitations
    where work_email = v_email;

    if found then
      v_result := pg_catalog.jsonb_build_object(
        'status', 'already_pending',
        'invitationId', v_invitation_id,
        'workEmail', v_email
      );
    else
      insert into crm_employees.invitations(
        display_name,
        work_email,
        requested_by
      )
      values (
        v_name,
        v_email,
        v_actor
      )
      returning id into v_invitation_id;

      v_result := pg_catalog.jsonb_build_object(
        'status', 'queued',
        'invitationId', v_invitation_id,
        'workEmail', v_email
      );
    end if;
  end if;

  insert into crm_employees.invitation_receipts (
    request_id,
    requested_by,
    display_name,
    work_email,
    result
  )
  values (
    p_request_id,
    v_actor,
    v_name,
    v_email,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.crm_request_employee_invitation(uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.crm_request_employee_invitation(uuid, text, text)
  to authenticated;

notify pgrst, 'reload schema';