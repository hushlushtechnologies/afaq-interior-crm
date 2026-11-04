-- Isolated local database only. Every fixture and privilege probe rolls back.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';

-- Model future migrations created by the actual migration owner.
CREATE TABLE public.s12_privilege_probe (id bigint GENERATED ALWAYS AS IDENTITY);
ALTER TABLE public.s12_privilege_probe ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.s12_privilege_probe() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS 'SELECT 1';
CREATE FUNCTION crm_access.s12_privilege_probe() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS 'SELECT 1';
CREATE FUNCTION crm_employees.s12_privilege_probe() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS 'SELECT 1';

DO $$
declare
  r text; obj record;
begin
  foreach r in array array['anon','authenticated','service_role'] loop
    if has_schema_privilege(r,'public','CREATE') or
       has_schema_privilege(r,'crm_access','USAGE') or
       has_schema_privilege(r,'crm_employees','USAGE') then
      raise exception 'Unexpected schema privileges: %', r;
    end if;
    if has_table_privilege(r,'public.s12_privilege_probe','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or
       has_sequence_privilege(r,'public.s12_privilege_probe_id_seq','USAGE,SELECT,UPDATE') then
      raise exception 'Future public data privileges leaked: %', r;
    end if;
  end loop;
  for obj in
    select c.oid,n.nspname,c.relname,c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('crm_access','crm_employees','public') and c.relkind in ('r','p')
  loop
    if not obj.relrowsecurity then raise exception 'RLS missing: %.%',obj.nspname,obj.relname; end if;
    foreach r in array array['anon','authenticated','service_role'] loop
      if obj.nspname<>'public' and has_table_privilege(r,obj.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception 'Private table privilege leaked: %.% to %',obj.nspname,obj.relname,r;
      end if;
    end loop;
  end loop;
  for obj in
    select p.oid,n.nspname,p.proname,p.prosecdef,p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('crm_access','crm_employees')
       or (n.nspname='public' and (p.proname like 'crm\_%' escape '\' or p.proname='s12_privilege_probe'))
  loop
    if not obj.prosecdef or not ('search_path=""'=any(coalesce(obj.proconfig,array[]::text[]))) then
      raise exception 'Unsafe definer configuration: %.%',obj.nspname,obj.proname;
    end if;
    if has_function_privilege('anon',obj.oid,'EXECUTE') then
      raise exception 'Anonymous function execution leaked: %.%',obj.nspname,obj.proname;
    end if;
    if obj.nspname='public' and obj.proname like 'crm\_%' escape '\' then
      if has_function_privilege('authenticated',obj.oid,'EXECUTE') is distinct from
           (obj.proname not in ('crm_bootstrap_super_admin','crm_reconcile_local_employee_invitation')) or
         has_function_privilege('service_role',obj.oid,'EXECUTE') is distinct from
           (obj.proname in ('crm_bootstrap_super_admin','crm_reconcile_local_employee_invitation',
             'crm_assign_user_role','crm_revoke_user_role','crm_get_role_account','crm_change_user_role')) then
        raise exception 'Existing RPC role contract changed: %',obj.proname;
      end if;
    end if;
    if obj.nspname<>'public' or obj.proname='s12_privilege_probe' then
      if has_function_privilege('authenticated',obj.oid,'EXECUTE') or
         has_function_privilege('service_role',obj.oid,'EXECUTE') then
        raise exception 'Private/new function execution leaked: %.%',obj.nspname,obj.proname;
      end if;
    end if;
  end loop;
  if has_function_privilege('authenticated','public.crm_bootstrap_super_admin(uuid)','EXECUTE') or
     has_function_privilege('authenticated','public.crm_reconcile_local_employee_invitation(uuid,uuid,boolean)','EXECUTE') or
     not has_function_privilege('service_role','public.crm_bootstrap_super_admin(uuid)','EXECUTE') or
     not has_function_privilege('service_role','public.crm_reconcile_local_employee_invitation(uuid,uuid,boolean)','EXECUTE') then
    raise exception 'Service-only RPC boundary changed';
  end if;
end;
$$;

-- Actual role switching verifies enforcement, not just ACL inspection.
SET LOCAL ROLE anon;
DO $$
begin
  begin perform public.s12_privilege_probe(); raise exception 'Anonymous executed new definer';
  exception when insufficient_privilege then null; end;
  begin perform public.crm_get_my_access(); raise exception 'Anonymous executed access RPC';
  exception when insufficient_privilege then null; end;
end;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
begin
  begin perform 1 from crm_access.user_roles; raise exception 'Direct roles read allowed';
  exception when insufficient_privilege then null; end;
  begin update crm_employees.employees set employment_status='active'; raise exception 'Direct employee write allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.s12_privilege_probe(); raise exception 'Authenticated executed new definer';
  exception when insufficient_privilege then null; end;
  begin insert into public.s12_privilege_probe default values; raise exception 'Future table insert allowed';
  exception when insufficient_privilege then null; end;
  begin execute 'create table public.s12_unauthorized(id integer)'; raise exception 'API DDL allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.crm_employee_directory('',0); raise exception 'Missing identity read directory';
  exception when insufficient_privilege then null; end;
  begin perform public.crm_change_user_role('nobody@example.test','super_admin','assign'); raise exception 'Missing identity administered roles';
  exception when insufficient_privilege then null; end;
end;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
begin
  begin perform 1 from crm_employees.invitation_events; raise exception 'Service directly read private audit';
  exception when insufficient_privilege then null; end;
  begin perform public.s12_privilege_probe(); raise exception 'Service executed future definer';
  exception when insufficient_privilege then null; end;
end;
$$;
RESET ROLE;

-- An explicit SELECT/INSERT grant still cannot bypass RLS with no policy.
INSERT INTO public.s12_privilege_probe DEFAULT VALUES;
GRANT SELECT, INSERT ON public.s12_privilege_probe TO authenticated;
GRANT USAGE ON SEQUENCE public.s12_privilege_probe_id_seq TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
begin
  if (select count(*) from public.s12_privilege_probe) <> 0 then
    raise exception 'RLS exposed an unauthorized row';
  end if;
  begin insert into public.s12_privilege_probe default values;
    raise exception 'RLS allowed an insert without a policy';
  exception when insufficient_privilege then null; end;
end;
$$;
RESET ROLE;
ROLLBACK;
