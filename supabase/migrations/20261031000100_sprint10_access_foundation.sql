create schema crm_access;

create table crm_access.roles (
  role_key text primary key
    check (role_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null
);

create table crm_access.permissions (
  permission_key text primary key
    check (
      permission_key ~
      '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    ),
  label text not null
);

create table crm_access.role_permissions (
  role_key text not null
    references crm_access.roles (role_key),
  permission_key text not null
    references crm_access.permissions (permission_key),
  scope_key text not null
    check (scope_key in ('own', 'assigned', 'company')),
  primary key (role_key, permission_key, scope_key)
);

create table crm_access.user_roles (
  user_id uuid not null
    references auth.users (id) on delete cascade,
  role_key text not null
    references crm_access.roles (role_key),
  assigned_by uuid
    references auth.users (id) on delete set null,
  assigned_at timestamptz not null
    default pg_catalog.now(),
  primary key (user_id, role_key)
);

create index role_permissions_permission_idx
  on crm_access.role_permissions (permission_key);

create index user_roles_role_idx
  on crm_access.user_roles (role_key, user_id);

create index user_roles_assigned_by_idx
  on crm_access.user_roles (assigned_by)
  where assigned_by is not null;

alter table crm_access.roles enable row level security;
alter table crm_access.permissions enable row level security;
alter table crm_access.role_permissions enable row level security;
alter table crm_access.user_roles enable row level security;

insert into crm_access.roles (role_key, label)
values
  ('super_admin', 'Super Admin'),
  ('management_director', 'Management / Director'),
  ('sales_executive', 'Sales Executive'),
  ('project_manager', 'Project Manager'),
  ('interior_designer', 'Interior Designer'),
  ('site_engineer', 'Site Engineer'),
  ('procurement_officer', 'Procurement Officer'),
  ('finance_officer', 'Finance Officer');

insert into crm_access.permissions (permission_key, label)
values
  ('dashboard.view', 'View dashboard'),
  ('leads.view', 'View leads'),
  ('leads.create', 'Create leads'),
  ('leads.update', 'Update leads'),
  ('leads.assign', 'Assign leads'),
  ('leads.mark_won', 'Mark eligible opportunities Won'),
  ('leads.mark_lost', 'Mark opportunities Lost'),
  ('quotations.view', 'View quotations'),
  ('quotations.create', 'Create quotations'),
  ('quotations.update', 'Update quotations'),
  ('quotations.submit', 'Submit quotations for approval'),
  ('quotations.approve', 'Approve quotations'),
  ('quotations.share', 'Share approved quotations'),
  ('quotations.internal_costs.view', 'View quotation internal costs'),
  ('clients.view', 'View clients'),
  ('clients.create', 'Create clients'),
  ('clients.update', 'Update clients'),
  ('projects.view', 'View projects'),
  ('projects.update', 'Update projects'),
  ('projects.financials.view', 'View permitted project financial information'),
  ('ai_studio.view', 'View AI Studio'),
  ('ai_studio.generate', 'Request AI generations'),
  ('design.view', 'View design work'),
  ('design.update', 'Update design work'),
  ('design.submit_review', 'Submit design revisions for review'),
  ('design.approve_internal', 'Approve internal design revisions'),
  ('site.view', 'View site work'),
  ('site.update', 'Update site work'),
  ('procurement.view', 'View procurement'),
  ('procurement.manage', 'Manage procurement'),
  ('inventory.view', 'View inventory'),
  ('inventory.manage', 'Manage inventory'),
  ('finance.view', 'View financial work'),
  ('finance.manage', 'Manage financial work'),
  ('reports.view', 'View permitted reports'),
  ('employees.view', 'View permitted employee information'),
  ('settings.view', 'View permitted settings'),
  ('access.roles.manage', 'Assign and remove employee roles');

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select 'super_admin', permission_key, 'company'
from crm_access.permissions;

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select role_key, 'settings.view', 'own'
from crm_access.roles
where role_key <> 'super_admin';

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select 'management_director', permission_key, 'company'
from crm_access.permissions
where permission_key like '%.view'
  and permission_key <> 'settings.view';

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select 'sales_executive', permission_key, 'assigned'
from unnest(array[
  'dashboard.view',
  'leads.view',
  'leads.update',
  'leads.mark_won',
  'leads.mark_lost',
  'quotations.view',
  'quotations.create',
  'quotations.update',
  'quotations.submit',
  'quotations.share',
  'clients.view',
  'clients.update',
  'projects.view',
  'reports.view'
]::text[]) as permitted(permission_key);

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select 'sales_executive', permission_key, 'own'
from unnest(array[
  'leads.create',
  'clients.create'
]::text[]) as permitted(permission_key);

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select 'project_manager', permission_key, 'assigned'
from unnest(array[
  'dashboard.view',
  'leads.view',
  'leads.update',
  'quotations.view',
  'quotations.create',
  'quotations.update',
  'quotations.submit',
  'quotations.approve',
  'quotations.share',
  'quotations.internal_costs.view',
  'clients.view',
  'projects.view',
  'projects.update',
  'projects.financials.view',
  'ai_studio.view',
  'design.view',
  'design.update',
  'design.submit_review',
  'design.approve_internal',
  'site.view',
  'procurement.view',
  'inventory.view',
  'finance.view',
  'reports.view'
]::text[]) as permitted(permission_key);

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select 'interior_designer', permission_key, 'assigned'
from unnest(array[
  'dashboard.view',
  'clients.view',
  'projects.view',
  'ai_studio.view',
  'ai_studio.generate',
  'design.view',
  'design.update',
  'design.submit_review',
  'reports.view'
]::text[]) as permitted(permission_key);

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select 'site_engineer', permission_key, 'assigned'
from unnest(array[
  'dashboard.view',
  'projects.view',
  'design.view',
  'site.view',
  'site.update',
  'inventory.view',
  'reports.view'
]::text[]) as permitted(permission_key);

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select 'procurement_officer', permission_key, 'company'
from unnest(array[
  'dashboard.view',
  'projects.view',
  'procurement.view',
  'procurement.manage',
  'inventory.view',
  'inventory.manage',
  'reports.view'
]::text[]) as permitted(permission_key);

insert into crm_access.role_permissions (
  role_key, permission_key, scope_key
)
select 'finance_officer', permission_key, 'company'
from unnest(array[
  'dashboard.view',
  'quotations.view',
  'quotations.internal_costs.view',
  'clients.view',
  'projects.view',
  'projects.financials.view',
  'procurement.view',
  'inventory.view',
  'finance.view',
  'finance.manage',
  'reports.view'
]::text[]) as permitted(permission_key);

create function crm_access.is_eligible_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as account
    where account.id = p_user_id
      and coalesce(account.email, '') <> ''
      and account.email_confirmed_at is not null
      and account.deleted_at is null
      and (
        account.banned_until is null
        or account.banned_until <= pg_catalog.now()
      )
  );
$$;

create function crm_access.is_super_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    crm_access.is_eligible_user(p_user_id)
    and exists (
      select 1
      from crm_access.user_roles as membership
      where membership.user_id = p_user_id
        and membership.role_key = 'super_admin'
    );
$$;

create function public.crm_get_my_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
     or not crm_access.is_eligible_user(v_user_id) then
    raise exception using
      errcode = '42501',
      message = 'A verified employee account is required.';
  end if;

  return pg_catalog.jsonb_build_object(
    'userId', v_user_id,
    'roles',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          membership.role_key
          order by membership.role_key
        )
        from crm_access.user_roles as membership
        where membership.user_id = v_user_id
      ),
      '[]'::jsonb
    ),
    'grants',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'permission', permission_rows.permission_key,
            'scope', permission_rows.scope_key
          )
          order by
            permission_rows.permission_key,
            permission_rows.scope_key
        )
        from (
          select distinct
            grant_row.permission_key,
            grant_row.scope_key
          from crm_access.user_roles as membership
          join crm_access.role_permissions as grant_row
            on grant_row.role_key = membership.role_key
          where membership.user_id = v_user_id
        ) as permission_rows
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create function public.crm_has_permission(
  p_permission_key text,
  p_scope_key text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and crm_access.is_eligible_user(auth.uid())
    and (
      p_scope_key is null
      or p_scope_key in ('own', 'assigned', 'company')
    )
    and exists (
      select 1
      from crm_access.user_roles as membership
      join crm_access.role_permissions as grant_row
        on grant_row.role_key = membership.role_key
      where membership.user_id = auth.uid()
        and grant_row.permission_key = p_permission_key
        and (
          p_scope_key is null
          or grant_row.scope_key = p_scope_key
          or grant_row.scope_key = 'company'
        )
    );
$$;

create function crm_access.assert_role_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return;
  end if;

  if not (
    crm_access.is_super_admin(auth.uid())
    and public.crm_has_permission(
      'access.roles.manage',
      'company'
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'Role administration is not permitted.';
  end if;

  return;
end;
$$;

create function crm_access.protect_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role_key = 'super_admin' then
    perform pg_catalog.pg_advisory_xact_lock(
      90310001::bigint
    );

    if not exists (
      select 1
      from crm_access.user_roles as membership
      where membership.role_key = 'super_admin'
        and membership.user_id <> old.user_id
        and crm_access.is_eligible_user(
          membership.user_id
        )
    ) then
      raise exception using
        errcode = '23514',
        message = 'The last eligible Super Admin cannot be removed.';
    end if;
  end if;

  return old;
end;
$$;

create trigger protect_last_super_admin
before delete on crm_access.user_roles
for each row
execute function crm_access.protect_last_super_admin();

create function public.crm_assign_user_role(
  p_user_id uuid,
  p_role_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    90310001::bigint
  );

  perform crm_access.assert_role_admin();

  if p_user_id is null
     or not exists (
       select 1
       from auth.users as account
       where account.id = p_user_id
         and account.deleted_at is null
     ) then
    raise exception using
      errcode = '22023',
      message = 'The target account is not available.';
  end if;

  if not exists (
    select 1
    from crm_access.roles as role_definition
    where role_definition.role_key = p_role_key
  ) then
    raise exception using
      errcode = '22023',
      message = 'The role is not recognized.';
  end if;

  insert into crm_access.user_roles (
    user_id,
    role_key,
    assigned_by
  )
  values (
    p_user_id,
    p_role_key,
    auth.uid()
  )
  on conflict (user_id, role_key) do nothing;

  return;
end;
$$;

create function public.crm_revoke_user_role(
  p_user_id uuid,
  p_role_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    90310001::bigint
  );

  perform crm_access.assert_role_admin();

  if p_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'The target account is required.';
  end if;

  if not exists (
    select 1
    from crm_access.roles as role_definition
    where role_definition.role_key = p_role_key
  ) then
    raise exception using
      errcode = '22023',
      message = 'The role is not recognized.';
  end if;

  delete from crm_access.user_roles
  where user_id = p_user_id
    and role_key = p_role_key;

  return;
end;
$$;

create function public.crm_bootstrap_super_admin(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    90310001::bigint
  );

  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Privileged bootstrap access is required.';
  end if;

  if not crm_access.is_eligible_user(p_user_id) then
    raise exception using
      errcode = '22023',
      message = 'The bootstrap account must be eligible and email-confirmed.';
  end if;

  if exists (
    select 1
    from crm_access.user_roles
    where role_key = 'super_admin'
  ) then
    if exists (
      select 1
      from crm_access.user_roles
      where role_key = 'super_admin'
        and user_id = p_user_id
    ) then
      return;
    end if;

    raise exception using
      errcode = '23514',
      message = 'A Super Admin already exists.';
  end if;

  insert into crm_access.user_roles (
    user_id,
    role_key,
    assigned_by
  )
  values (
    p_user_id,
    'super_admin',
    null
  );

  return;
end;
$$;

revoke all on schema crm_access
  from public, anon, authenticated, service_role;

revoke all on all tables in schema crm_access
  from public, anon, authenticated, service_role;

revoke all on all functions in schema crm_access
  from public, anon, authenticated, service_role;

alter default privileges in schema crm_access
  revoke all on tables
  from public, anon, authenticated, service_role;

alter default privileges in schema crm_access
  revoke execute on functions
  from public, anon, authenticated, service_role;

revoke all on function public.crm_get_my_access()
  from public, anon, authenticated, service_role;

revoke all on function public.crm_has_permission(text, text)
  from public, anon, authenticated, service_role;

revoke all on function public.crm_assign_user_role(uuid, text)
  from public, anon, authenticated, service_role;

revoke all on function public.crm_revoke_user_role(uuid, text)
  from public, anon, authenticated, service_role;

revoke all on function public.crm_bootstrap_super_admin(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.crm_get_my_access()
  to authenticated;

grant execute on function public.crm_has_permission(text, text)
  to authenticated;

grant execute on function public.crm_assign_user_role(uuid, text)
  to authenticated, service_role;

grant execute on function public.crm_revoke_user_role(uuid, text)
  to authenticated, service_role;

grant execute on function public.crm_bootstrap_super_admin(uuid)
  to service_role;

notify pgrst, 'reload schema';