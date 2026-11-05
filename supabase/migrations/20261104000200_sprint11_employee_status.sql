alter table crm_employees.employees
  add column updated_at timestamptz not null default now(),
  add column deactivated_at timestamptz;

create table crm_employees.account_status_events (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  target_user_id uuid not null references auth.users(id),
  previous_status text not null check (previous_status in ('active', 'inactive')),
  new_status text not null check (new_status in ('active', 'inactive')),
  occurred_at timestamptz not null default now(),
  check (previous_status <> new_status)
);
alter table crm_employees.account_status_events enable row level security;
revoke all on crm_employees.account_status_events from public, anon, authenticated, service_role;

create or replace function crm_access.is_eligible_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users account where account.id = p_user_id
      and coalesce(account.email, '') <> '' and account.email_confirmed_at is not null
      and account.deleted_at is null
      and (account.banned_until is null or account.banned_until <= now())
      and not exists(select 1 from crm_employees.employees employee
        where employee.auth_user_id = account.id and employee.employment_status <> 'active')
      and not exists(select 1 from crm_employees.invitations invitation
        where (invitation.auth_user_id = account.id or invitation.work_email = lower(account.email))
          and invitation.status <> 'accepted')
  );
$$;

create function crm_employees.protect_employee_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(90310001::bigint);
  if TG_OP = 'UPDATE' and new.auth_user_id is distinct from old.auth_user_id then
    raise exception using errcode = '42501', message = 'Employee identity cannot be replaced.';
  end if;
  if new.employment_status <> 'active'
     and exists(select 1 from crm_access.user_roles where user_id = new.auth_user_id and role_key = 'super_admin')
     and not exists(select 1 from crm_access.user_roles where role_key = 'super_admin'
       and user_id <> new.auth_user_id and crm_access.is_eligible_user(user_id)) then
    raise exception using errcode = '23514', message = 'The final eligible Super Admin must remain active.';
  end if;
  return new;
end;
$$;
create trigger protect_employee_status before insert or update on crm_employees.employees
for each row execute function crm_employees.protect_employee_status();
revoke all on function crm_employees.protect_employee_status() from public, anon, authenticated, service_role;

create function public.crm_get_my_employee_status()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select employment_status from crm_employees.employees where auth_user_id = auth.uid()),
    case when exists(select 1 from crm_employees.invitations where (auth_user_id = auth.uid() or work_email = (select lower(email) from auth.users where id = auth.uid()))
      and status <> 'accepted') then 'invited' else 'active' end)
  where auth.uid() is not null;
$$;

create function public.crm_employee_directory(p_search text default '', p_page integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if public.crm_has_permission('employees.view', 'company') is not true then
    raise exception using errcode = '42501', message = 'Company employee visibility is required.';
  end if;
  if p_search is null or length(p_search) > 100 or p_page is null or p_page not between 0 and 10000 then
    raise exception using errcode = '22023', message = 'Invalid directory query.';
  end if;
  with records as (
    select account.id as user_id, coalesce(employee.display_name, account.email) as name,
      account.email, coalesce(employee.employment_status,
        case when account.email_confirmed_at is null or invitation.status is not null and invitation.status <> 'accepted' then 'invited' else 'active' end) as status,
      account.email_confirmed_at is not null as confirmed,
      (account.banned_until is not null and account.banned_until > now()) as blocked,
      coalesce((select jsonb_agg(role_key order by role_key) from crm_access.user_roles
        where user_id = account.id), '[]'::jsonb) as roles,
      invitation.status as invitation_status
    from auth.users account
    left join crm_employees.employees employee on employee.auth_user_id = account.id
    left join lateral (
      select i.status from crm_employees.invitations i
      where i.auth_user_id = account.id or i.work_email = lower(account.email)
      order by (i.auth_user_id = account.id) desc nulls last limit 1
    ) invitation on true
    where account.deleted_at is null and coalesce(account.email, '') <> ''
    union all
    select null::uuid, i.display_name, i.work_email, 'invited', false, false, '[]'::jsonb, i.status
    from crm_employees.invitations i where i.auth_user_id is null
      and not exists(select 1 from auth.users where lower(email) = i.work_email)
  ), filtered as (
    select * from records where position(lower(btrim(p_search)) in lower(name || ' ' || email)) > 0
  ), selected as (
    select * from filtered order by lower(email), user_id nulls last limit 20 offset p_page * 20
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', user_id, 'name', name, 'email', email, 'status', status,
      'confirmed', confirmed, 'blocked', blocked, 'roles', roles, 'invitationStatus', invitation_status
    ) order by lower(email)) from selected), '[]'::jsonb),
    'total', (select count(*) from filtered), 'page', p_page,
    'canManage', crm_access.is_super_admin(auth.uid()) and public.crm_has_permission('access.roles.manage', 'company')
  ) into v_result;
  return v_result;
end;
$$;

create function public.crm_change_employee_status(
  p_request_id uuid, p_user_id uuid, p_expected text, p_status text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_current text; v_account auth.users%rowtype;
  v_previous crm_employees.account_status_events%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(90310001::bigint);
  if crm_access.is_super_admin(auth.uid()) is not true
     or public.crm_has_permission('access.roles.manage', 'company') is not true then
    raise exception using errcode = '42501', message = 'Super Admin required.';
  end if;
  if p_request_id is null or p_user_id is null or p_expected is null or p_status is null
     or p_expected not in ('active', 'inactive') or p_status not in ('active', 'inactive') or p_expected = p_status then
    raise exception using errcode = '22023', message = 'Invalid status change.';
  end if;
  select * into v_account from auth.users where id = p_user_id and deleted_at is null;
  if not found then raise exception using errcode = '22023', message = 'Account is unavailable.'; end if;
  select coalesce((select employment_status from crm_employees.employees where auth_user_id = p_user_id),
    case when v_account.email_confirmed_at is null or exists(select 1 from crm_employees.invitations
      where (auth_user_id = p_user_id or work_email = lower(v_account.email)) and status <> 'accepted') then 'invited' else 'active' end) into v_current;
  select * into v_previous from crm_employees.account_status_events where request_id = p_request_id;
  if found then
    if v_previous.actor_id <> auth.uid() or v_previous.target_user_id <> p_user_id
       or v_previous.previous_status <> p_expected or v_previous.new_status <> p_status then
      raise exception using errcode = '22023', message = 'Request ID was used for different input.';
    end if;
    return jsonb_build_object('status', v_current, 'replayed', true);
  end if;
  if v_current <> p_expected then
    raise exception using errcode = '40001', message = 'Account status changed. Reload before retrying.';
  end if;
  if p_status = 'active' and (v_account.email_confirmed_at is null
     or (v_account.banned_until is not null and v_account.banned_until > now())) then
    raise exception using errcode = '22023', message = 'Verify and unblock the Auth identity first.';
  end if;
  insert into crm_employees.employees(auth_user_id, display_name, work_email, employment_status, deactivated_at)
    values(p_user_id, v_account.email, lower(v_account.email), p_status,
      case when p_status = 'inactive' then now() else null end)
    on conflict (auth_user_id) do update set employment_status = excluded.employment_status,
      deactivated_at = excluded.deactivated_at, updated_at = now();
  insert into crm_employees.account_status_events(request_id, actor_id, target_user_id, previous_status, new_status)
    values(p_request_id, auth.uid(), p_user_id, p_expected, p_status);
  return jsonb_build_object('status', p_status, 'replayed', false);
end;
$$;

revoke all on function public.crm_get_my_employee_status() from public, anon, authenticated, service_role;
revoke all on function public.crm_employee_directory(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.crm_change_employee_status(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.crm_get_my_employee_status() to authenticated;
grant execute on function public.crm_employee_directory(text, integer) to authenticated;
grant execute on function public.crm_change_employee_status(uuid, uuid, text, text) to authenticated;

create function crm_employees.can_accept_invitation(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users account where account.id = p_user_id
    and coalesce(account.email, '') <> '' and account.email_confirmed_at is not null
    and account.deleted_at is null and (account.banned_until is null or account.banned_until <= now())
    and not exists(select 1 from crm_employees.employees where auth_user_id = account.id
      and employment_status <> 'active'));
$$;
revoke all on function crm_employees.can_accept_invitation(uuid) from public, anon, authenticated, service_role;

create or replace function public.crm_get_my_employee_invitation()
returns text language sql stable security definer set search_path = '' as $$
  select case when invitation.status = 'delivery_uncertain' then 'delivered' else invitation.status end from crm_employees.invitations invitation
  where invitation.auth_user_id = auth.uid()
    and invitation.status in ('delivered', 'delivery_uncertain', 'accepted')
    and crm_employees.can_accept_invitation(auth.uid());
$$;

create or replace function public.crm_accept_employee_invitation()
returns void language plpgsql security definer set search_path = '' as $$
declare v crm_employees.invitations%rowtype;
begin
  select * into v from crm_employees.invitations
    where auth_user_id = auth.uid() for update;
  if not found or v.status not in ('delivered', 'delivery_uncertain', 'accepted')
     or crm_employees.can_accept_invitation(auth.uid()) is not true
     or not exists(select 1 from auth.users where id = auth.uid()
       and coalesce(encrypted_password, '') <> '') then
    raise exception using errcode = '42501', message = 'Verified invitation and password required.';
  end if;
  if v.status = 'accepted' then return; end if;
  insert into crm_employees.employees(auth_user_id, display_name, work_email, employment_status)
    values (auth.uid(), v.display_name, v.work_email, 'active');
  update crm_employees.invitations set status = 'accepted', accepted_at = now() where id = v.id;
end;
$$;

notify pgrst, 'reload schema';