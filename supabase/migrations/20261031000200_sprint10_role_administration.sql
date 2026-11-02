create function crm_access.role_account_json(p_user_id uuid)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'userId', account.id,
    'email', account.email,
    'roles',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          membership.role_key
          order by membership.role_key
        )
        from crm_access.user_roles as membership
        where membership.user_id = account.id
      ),
      '[]'::jsonb
    )
  )
  from auth.users as account
  where account.id = p_user_id
    and account.deleted_at is null;
$$;

create function public.crm_get_role_account(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  perform crm_access.assert_role_admin();

  if p_email is null
     or pg_catalog.btrim(p_email) = ''
     or pg_catalog.length(p_email) > 254 then
    raise exception using
      errcode = '22023',
      message = 'A valid account email is required.';
  end if;

  select account.id
  into v_user_id
  from auth.users as account
  where pg_catalog.lower(account.email) =
        pg_catalog.lower(pg_catalog.btrim(p_email))
    and account.deleted_at is null
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  return crm_access.role_account_json(v_user_id);
end;
$$;

create function public.crm_change_user_role(
  p_email text,
  p_role_key text,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    90310001::bigint
  );

  perform crm_access.assert_role_admin();

  if p_email is null
     or pg_catalog.btrim(p_email) = ''
     or pg_catalog.length(p_email) > 254 then
    raise exception using
      errcode = '22023',
      message = 'A valid account email is required.';
  end if;

  if p_operation is null
     or p_operation not in ('assign', 'revoke') then
    raise exception using
      errcode = '22023',
      message = 'The role operation is not recognized.';
  end if;

  select account.id
  into v_user_id
  from auth.users as account
  where pg_catalog.lower(account.email) =
        pg_catalog.lower(pg_catalog.btrim(p_email))
    and account.deleted_at is null
  limit 1;

  if v_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'The target account is not available.';
  end if;

  if p_operation = 'assign' then
    perform public.crm_assign_user_role(
      v_user_id,
      p_role_key
    );
  else
    perform public.crm_revoke_user_role(
      v_user_id,
      p_role_key
    );
  end if;

  return crm_access.role_account_json(v_user_id);
end;
$$;

revoke all on function crm_access.role_account_json(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.crm_get_role_account(text)
  from public, anon, authenticated, service_role;

revoke all on function public.crm_change_user_role(text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.crm_get_role_account(text)
  to authenticated, service_role;

grant execute on function public.crm_change_user_role(text, text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';