# Role administration

## Access

/settings/access requires access.roles.manage with company scope.

Navigation and search hide the page when that requirement is missing.

Server Actions independently load current database-backed permissions.
The database independently requires Super Admin authority for employee
role administration.

Client context and authentication metadata are not authority.

## Existing accounts

The administrator looks up an existing account by email.

The restricted RPC returns only its ID, email, and role keys.

This page does not create accounts, invite employees, or change account
activation. Those workflows belong to Sprint 11.

## Confirmation

Each role change requires confirmation.

The checkbox reflects the last confirmed database result.
It is not an optimistic authorization grant.

Cancel receives initial dialog focus.
Pending operations prevent duplicate changes.

## Atomic mutation

crm_change_user_role:
- Acquires the shared role-change advisory lock.
- Verifies current role-administration authority.
- Resolves the target account from its email.
- Calls the existing assign or revoke function.
- Returns the resulting role membership within the transaction.

The last eligible Super Admin guard remains active.

No client-supplied actor ID or role snapshot is used.

## UI updates

Successful changes update the displayed target roles and refresh the
current page.

A self-demotion may remove the administrator's access to this page.

Other employees receive current database grants on subsequent server
requests. Their already-open navigation may require refresh.

Server and database operations do not trust stale client navigation.

## Navigation

The existing rail, drawer, section navigation, and search layouts are
retained.

Their links come from the validated access context.

The mobile drawer's outdated authentication-disconnected text is removed.

## Scope boundary

Assigned and own capability scopes still need actual record relationships
and applicable business-table RLS.

This work does not implement those business record services.

## Tests

Production tests cover role assignment and removal through the UI,
confirmation focus, filtered Sales navigation, and direct URL denial.

Database-level privilege and role-policy checks are completed in Part 4.

Temporary test Super Admin accounts are cleaned up while the existing
eligible bootstrap Super Admin remains.

## Local test configuration

The local sign-in allowance is 100 to support temporary-account tests.
Hosted rate limits require a separate deployment review.

## Validation status

Code supplied for local execution.
The managed cloud environment was unavailable.