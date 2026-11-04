sql
-- Run only through the dedicated local project's Docker database container.
-- All changes below are rolled back. Never run against a hosted database.

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  actor_id uuid;
  before_roles jsonb;
  rejected boolean := false;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(90310001::bigint);

  SELECT membership.user_id INTO actor_id
  FROM crm_access.user_roles AS membership
  WHERE membership.role_key = 'super_admin'
    AND crm_access.is_eligible_user(membership.user_id)
  ORDER BY membership.user_id
  LIMIT 1;

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'A confirmed local Super Admin is required.';
  END IF;

  -- Establish the last-admin condition only inside this rollback transaction.
  DELETE FROM crm_access.user_roles
  WHERE role_key = 'super_admin' AND user_id <> actor_id;

  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );

  before_roles := crm_access.role_account_json(actor_id);

  BEGIN
    PERFORM public.crm_revoke_user_role(actor_id, 'super_admin');
  EXCEPTION WHEN check_violation THEN
    rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION 'FAIL: final eligible Super Admin removal was accepted.';
  END IF;

  IF crm_access.role_account_json(actor_id) IS DISTINCT FROM before_roles THEN
    RAISE EXCEPTION 'FAIL: rejected removal changed role memberships.';
  END IF;

  RAISE NOTICE 'PASS: final eligible Super Admin removal rejected; roles unchanged.';
END;
$$;
ROLLBACK;
```