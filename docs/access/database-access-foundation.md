# Database access foundation

## Approved policy

The user approved the proposed Sprint 10 role policy.

Super Admin controls employee role assignments.
Director has company-wide read capabilities.
Operational staff receive the approved assigned or company scopes.
Multiple roles combine their grants.

## Private schema

crm_access contains:
- roles
- permissions
- role_permissions
- user_roles

All four tables have RLS enabled with no direct-access policies.
Application roles have no direct schema or table privileges.

The schema is not added to the exposed API schemas.

## Trusted entry points

crm_get_my_access returns only the caller's effective access snapshot.

crm_has_permission checks the caller's capability and optional scope
coverage. Company scope covers own and assigned scopes.

crm_assign_user_role and crm_revoke_user_role require a verified
Super Admin employee with the role-management capability.

Trusted service-role operations are also allowed for bootstrap and
local fixtures. Service credentials must never be exposed to a browser.

Security-definer functions use an empty search_path and qualified
object references.

## Eligibility

Database access requires a confirmed email account that is not deleted
or currently banned in Supabase Auth.

Employee activation/deactivation management remains Sprint 11 work.

## Last Super Admin

Role mutations share a transaction-level advisory lock.

A trigger prevents deletion of the last eligible Super Admin role,
including deletion through an Auth user cascade.

The bootstrap function is service-role-only and supplies the first
Super Admin. Repeating it for that same eligible account is idempotent.

## Server checks

getMyAccess:
- Runs at request time.
- Validates authentication.
- Calls the authenticated database RPC.
- Validates the returned snapshot and user ID.

React cache only deduplicates this within the rendering request.

requireCapability checks the database-derived grants.
The server operation chooses its required permission.

Do not accept browser-supplied role snapshots or permission names as
authority for an operation.

## Scope boundary

A capability with assigned or own scope does not prove access to a
particular record.

Business services and RLS must verify real ownership and assignment
relationships when the relevant business tables are implemented.

Creation services must also control ownership and assignment fields.

Project and quotation financial fields require their financial
capabilities. Generic project viewing does not grant financial access.

## Business rules

PM quotation approval capability does not impose a self-approval ban.
The approved policy allows PMs to approve their own quotations.

Permission to mark Won does not replace the required PM approval and
client acceptance of the applicable quotation version.

Employee permissions do not constitute a client's approval.

## Part 2 boundary

The new database access objects are secured in this part.

Navigation, page-level capability gates, and role administration UI
are connected in subsequent Sprint 10 work.

Existing workspace authentication remains in place during this step.

## Local bootstrap

Run the local script with the intended confirmed account email.

The script restricts its origin, port, and project ID to the dedicated
local Supabase instance.

It does not create an Auth account or modify credentials.

## Validation

Apply the additive migration locally.
Run database lint, formatting, TypeScript, and application checks.
Inspect /dev/access-setup as the bootstrapped account.

The assistant checked catalogue consistency statically.
Database execution was unavailable in the managed cloud environment.