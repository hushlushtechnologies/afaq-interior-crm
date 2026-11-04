-- Existing CRM tables remain private and RPC-only. Preserve existing RPC grants.
-- PostgreSQL combines global and per-schema defaults: a schema REVOKE cannot
-- subtract the global implicit PUBLIC EXECUTE privilege on new functions.
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema crm_access, crm_employees
  revoke execute on functions from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema crm_access, crm_employees
  revoke all on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema crm_access, crm_employees
  revoke all on sequences from public, anon, authenticated, service_role;

revoke create on schema public from public, anon, authenticated, service_role;

-- Reassert the existing private-table contract without broadening RLS policies.
revoke all on schema crm_access, crm_employees
  from public, anon, authenticated, service_role;

revoke all on all tables in schema crm_access, crm_employees
  from public, anon, authenticated, service_role;

revoke all on all sequences in schema crm_access, crm_employees
  from public, anon, authenticated, service_role;

revoke all on all functions in schema crm_access, crm_employees
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';