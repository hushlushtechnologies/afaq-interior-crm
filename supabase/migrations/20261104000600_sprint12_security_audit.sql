-- Application/API append-only history. IDs deliberately have no Auth FK so that
-- deleting an account cannot erase or rewrite historical identity references.
create table crm_access.role_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_kind text not null
    check (actor_kind in ('employee', 'trusted_service', 'database')),
  target_user_id uuid not null,
  action text not null
    check (action in ('role_assigned', 'role_revoked')),
  role_key text not null,
  occurred_at timestamptz not null default clock_timestamp(),
  check ((actor_kind = 'employee') = (actor_id is not null))
);

alter table crm_access.role_events enable row level security;

revoke all on crm_access.role_events
  from public, anon, authenticated, service_role;

create index role_events_time_idx
  on crm_access.role_events(occurred_at desc, id desc);

create index role_events_target_idx
  on crm_access.role_events(target_user_id);

create index role_events_actor_idx
  on crm_access.role_events(actor_id);

create function crm_access.record_role_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into crm_access.role_events(
    actor_id,
    actor_kind,
    target_user_id,
    action,
    role_key
  )
  values (
    case
      when auth.role() = 'authenticated' then auth.uid()
      else null
    end,
    case
      when auth.role() = 'authenticated' and auth.uid() is not null
        then 'employee'
      when auth.role() = 'service_role'
        then 'trusted_service'
      else 'database'
    end,
    case when TG_OP = 'INSERT' then new.user_id else old.user_id end,
    case when TG_OP = 'INSERT' then 'role_assigned' else 'role_revoked' end,
    case when TG_OP = 'INSERT' then new.role_key else old.role_key end
  );

  return null;
end;
$$;

create trigger record_role_event
after insert or delete on crm_access.user_roles
for each row execute function crm_access.record_role_event();

create function crm_access.protect_membership_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.role_key is distinct from old.role_key then
    raise exception using
      errcode = '23514',
      message = 'Revoke and assign roles instead of reassigning membership identity.';
  end if;

  return new;
end;
$$;

create trigger protect_membership_identity
before update on crm_access.user_roles
for each row execute function crm_access.protect_membership_identity();

revoke all on function
  crm_access.record_role_event(),
  crm_access.protect_membership_identity()
from public, anon, authenticated, service_role;

create function public.crm_get_security_audit(
  p_page integer default 0,
  p_target_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_events jsonb;
  v_more boolean;
begin
  if crm_access.is_super_admin(auth.uid()) is not true
    or public.crm_has_permission(
      'access.roles.manage',
      'company'
    ) is not true then
    raise exception using
      errcode = '42501',
      message = 'Super Admin required.';
  end if;

  if p_page is null or p_page < 0 or p_page > 10000 then
    raise exception using
      errcode = '22023',
      message = 'Invalid audit page.';
  end if;

  with history as (
    select
      id,
      occurred_at as at,
      'roles'::text as source,
      action,
      actor_id,
      actor_kind,
      target_user_id as target_id,
      'account'::text as target_kind,
      role_key as detail
    from crm_access.role_events

    union all

    select
      request_id,
      occurred_at,
      'employee_status',
      'account_status_changed',
      actor_id,
      'employee',
      target_user_id,
      'account',
      previous_status || ' -> ' || new_status
    from crm_employees.account_status_events

    union all

    select
      id,
      occurred_at,
      'invitations',
      event,
      actor_id,
      case when actor_id is null then 'system' else 'employee' end,
      invitation_id,
      'invitation',
      concat_ws(' -> ', previous_status, new_status)
    from crm_employees.invitation_events
  ),
  windowed as (
    select *
    from history
    where p_target_id is null or target_id = p_target_id
    order by at desc, source, id desc
    limit 26
    offset (p_page * 25)
  ),
  numbered as (
    select
      *,
      row_number() over (
        order by at desc, source, id desc
      ) as position
    from windowed
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'at', at,
          'source', source,
          'action', action,
          'actorId', actor_id,
          'actorKind', actor_kind,
          'targetId', target_id,
          'targetKind', target_kind,
          'detail', detail
        )
        order by position
      ) filter (where position <= 25),
      '[]'::jsonb
    ),
    count(*) > 25
  into v_events, v_more
  from numbered;

  return jsonb_build_object(
    'page', p_page,
    'targetId', p_target_id,
    'hasMore', v_more,
    'events', v_events
  );
end;
$$;

revoke all on function public.crm_get_security_audit(integer, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.crm_get_security_audit(integer, uuid)
  to authenticated;

notify pgrst, 'reload schema';