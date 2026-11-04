create table crm_employees.invitation_recovery_requests (
  request_id uuid primary key,
  invitation_id uuid not null references crm_employees.invitations(id),
  actor_id uuid not null references auth.users(id),
  attempt_id uuid not null,
  created_at timestamptz not null default now()
);

create table crm_employees.invitation_events (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references crm_employees.invitations(id),
  actor_id uuid references auth.users(id),
  event text not null,
  previous_status text,
  new_status text not null,
  attempt_id uuid,
  occurred_at timestamptz not null default now()
);

alter table crm_employees.invitation_recovery_requests enable row level security;
alter table crm_employees.invitation_events enable row level security;

revoke all on crm_employees.invitation_recovery_requests,
  crm_employees.invitation_events
  from public, anon, authenticated, service_role;

create function crm_employees.audit_invitation_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if TG_OP = 'INSERT' then
    v_event := 'requested';
  elsif new.status is not distinct from old.status
    and new.delivery_attempt is not distinct from old.delivery_attempt
    and new.auth_user_id is not distinct from old.auth_user_id then
    return new;
  elsif new.delivery_attempt is distinct from old.delivery_attempt then
    v_event := 'delivery_started';
  elsif new.status = 'accepted' then
    v_event := 'accepted';
  elsif new.status = 'delivered' then
    v_event := 'delivery_confirmed';
  elsif new.status = 'delivery_uncertain' then
    v_event := 'delivery_uncertain';
  else
    v_event := 'identity_reconciled';
  end if;

  insert into crm_employees.invitation_events(
    invitation_id,
    actor_id,
    event,
    previous_status,
    new_status,
    attempt_id
  )
  values (
    new.id,
    auth.uid(),
    v_event,
    case when TG_OP = 'UPDATE' then old.status else null end,
    new.status,
    new.delivery_attempt
  );

  return new;
end;
$$;

create trigger audit_invitation_lifecycle
after insert or update on crm_employees.invitations
for each row execute function crm_employees.audit_invitation_lifecycle();

revoke all on function crm_employees.audit_invitation_lifecycle()
  from public, anon, authenticated, service_role;

create function public.crm_find_local_invitation(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v crm_employees.invitations%rowtype;
begin
  if crm_access.is_super_admin(auth.uid()) is not true
    or public.crm_has_permission('access.roles.manage', 'company') is not true then
    raise exception using
      errcode = '42501',
      message = 'Super Admin required.';
  end if;

  if p_email is null or length(p_email) > 254 then
    raise exception using
      errcode = '22023',
      message = 'Invalid email.';
  end if;

  select * into v
  from crm_employees.invitations
  where work_email = lower(btrim(p_email));

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v.id,
    'status', v.status,
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'event', e.event,
          'at', e.occurred_at,
          'actor', coalesce(
            (select email from auth.users where id = e.actor_id),
            'System'
          )
        )
        order by e.occurred_at desc
      )
      from (
        select *
        from crm_employees.invitation_events
        where invitation_id = v.id
        order by occurred_at desc
        limit 20
      ) e
    ), '[]'::jsonb)
  );
end;
$$;

create function public.crm_prepare_local_invitation_recovery(
  p_id uuid,
  p_request_id uuid,
  p_reviewed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v crm_employees.invitations%rowtype;
  r crm_employees.invitation_recovery_requests%rowtype;
  u auth.users%rowtype;
  v_kind text;
begin
  perform pg_advisory_xact_lock(90310001::bigint);

  if crm_access.is_super_admin(auth.uid()) is not true
    or public.crm_has_permission('access.roles.manage', 'company') is not true then
    raise exception using
      errcode = '42501',
      message = 'Super Admin required.';
  end if;

  if p_id is null or p_request_id is null or p_reviewed is not true then
    raise exception using
      errcode = '22023',
      message = 'Explicit local review is required.';
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

  select * into r
  from crm_employees.invitation_recovery_requests
  where request_id = p_request_id;

  if found then
    if r.invitation_id <> p_id or r.actor_id <> auth.uid() then
      raise exception using
        errcode = '22023',
        message = 'Request ID conflict.';
    end if;

    if r.attempt_id is distinct from v.delivery_attempt then
      return jsonb_build_object('status', 'superseded');
    end if;

    if v.status in ('delivered', 'accepted') then
      return jsonb_build_object('status', v.status);
    end if;

    if v.status = 'delivering'
      and v.delivery_started_at > now() - interval '60 seconds' then
      return jsonb_build_object('status', 'busy');
    end if;

    return jsonb_build_object(
      'status', 'check',
      'attemptId', v.delivery_attempt
    );
  end if;

  if v.status = 'accepted' then
    return jsonb_build_object('status', 'accepted');
  end if;

  if v.status = 'pending_delivery' then
    return jsonb_build_object('status', 'not_started');
  end if;

  if v.delivery_started_at > now() - interval '60 seconds' then
    return jsonb_build_object('status', 'busy');
  end if;

  if exists (
    select 1
    from crm_employees.employees
    where auth_user_id = v.auth_user_id
      and employment_status <> 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Inactive employee cannot be recovered.';
  end if;

  select * into u
  from auth.users
  where lower(email) = v.work_email
    and deleted_at is null
    and (
      id = v.auth_user_id
      or invited_at >= v.delivery_started_at
    )
  limit 1;

  if v.auth_user_id is not null
    and (u.id is null or u.id <> v.auth_user_id) then
    raise exception using
      errcode = '22023',
      message = 'Identity mismatch requires review.';
  end if;

  if u.id is null and exists (
    select 1 from auth.users where lower(email) = v.work_email
  ) then
    raise exception using
      errcode = '22023',
      message = 'Unrelated identity requires review.';
  end if;

  v_kind := case
    when u.email_confirmed_at is not null then 'recovery'
    else 'invite'
  end;

  update crm_employees.invitations
  set
    status = 'delivering',
    delivery_attempt = gen_random_uuid(),
    delivery_started_at = now(),
    auth_user_id = u.id
  where id = p_id
  returning * into v;

  insert into crm_employees.invitation_recovery_requests(
    request_id,
    invitation_id,
    actor_id,
    attempt_id
  )
  values (
    p_request_id,
    p_id,
    auth.uid(),
    v.delivery_attempt
  );

  insert into crm_employees.invitation_events(
    invitation_id,
    actor_id,
    event,
    new_status,
    attempt_id
  )
  values (
    p_id,
    auth.uid(),
    'replacement_authorized_after_review',
    v.status,
    v.delivery_attempt
  );

  return jsonb_build_object(
    'status', 'send',
    'attemptId', v.delivery_attempt,
    'email', v.work_email,
    'kind', v_kind
  );
end;
$$;

create or replace function public.crm_reconcile_local_employee_invitation(
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
    and deleted_at is null
    and (
      (v.auth_user_id is not null and id = v.auth_user_id)
      or (
        v.auth_user_id is null
        and invited_at >= v.delivery_started_at
      )
    )
  limit 1;

  update crm_employees.invitations
  set
    status = case
      when p_confirmed and v_user is not null then 'delivered'
      else 'delivery_uncertain'
    end,
    auth_user_id = coalesce(v_user, v.auth_user_id)
  where id = p_id;

  return case
    when p_confirmed and v_user is not null then 'delivered'
    else 'delivery_uncertain'
  end;
end;
$$;

revoke all on function public.crm_find_local_invitation(text)
  from public, anon, authenticated, service_role;

revoke all on function public.crm_prepare_local_invitation_recovery(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;

grant execute on function public.crm_find_local_invitation(text)
  to authenticated;

grant execute on function public.crm_prepare_local_invitation_recovery(uuid, uuid, boolean)
  to authenticated;

notify pgrst, 'reload schema';