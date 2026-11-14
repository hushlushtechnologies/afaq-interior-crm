# Sprint 19 Part 1 — Saved draft history

## Scope

Implemented against the existing Sprint 18 working tree at dc0b74f, preserving
the uncommitted Phase 3 and quotation implementation. This is a partial Sprint
19 delivery; it does not complete the sprint or authorize Sprint 20.

Added revision provenance, immutable saved evidence, authorized paginated history,
individual snapshot retrieval, and a saved-input/financial comparison UI. A saved
draft version remains distinct from a commercial revision. Existing quotations
remain Revision 1. No new commercial revision creation operation is exposed yet.

The existing quotation-view permission and resource authorization remain
authoritative, including Finance visibility and current Sales ownership. No role,
approval, delivery, Storage or final-Super-Admin policy was changed.

## Files

New: migration 20261114000100_sprint19_history_foundation.sql;
history-contracts.ts, history-actions.ts, compare-snapshots.ts;
quotation-history.tsx; quotation-history unit, SQL and browser tests;
playwright.quotation-history.config.ts; this report.

Modified: the quotation detail page and playwright.quotation-unit.config.ts.
No dependency installation is required.

## Migration verification

Applied only to the dedicated local Supabase database on port 57422. A private
pre-migration database archive was created outside Git and its directory checked;
no restore drill was performed. A disposable existing quotation with two authors
proved that backfill preserves the original creator/time and both saved inputs.

The initial transaction rolled back because a deferred self-reference had pending
trigger events before ALTER TABLE. The unapplied SQL was corrected to an initially
immediate foreign key, then applied successfully. No applied migration was edited.

The migration adds one private metadata table, a saved-version revision reference,
protective triggers and two authenticated read RPCs. Existing snapshots are retained.
Production application and destructive rollback are not authorized. Repair an
applied migration through a separately reviewed forward migration.

## Executed checks

- TypeScript, ESLint, changed TypeScript/config formatting and git diff checks pass.
- Quotation unit selection: 35 passed, including four new comparison cases.
- Existing quotation database selection: six passed, including cross-engine pricing,
  authorization, concurrent numbering, retries and optimistic updates.
- New history browser selection: four passed across desktop and mobile, including
  snapshot contracts, comparison and access revocation. Its SQL fixture also checks
  pagination, immutable evidence, actual authenticated RLS, Finance and denied roles.
- Existing quotation browser selection: eight passed after production build.
- Existing rollback-only SQL checks passed: last-super-admin,
  database-authorization, leads, lead-pipeline, lead-details and security-audit.

A test fixture calculation initially needed explicit contract parsing for its
literal policy type; corrected before the successful checks. Windows commands and
the owner's manual browser checklist were not executed in the cloud. The entire
Phase 3 browser suite was not rerun in this part. Existing Next.js listener-count
and NO_COLOR warnings remain visible and nonblocking in these runs.

## Remaining Sprint 19 work

Explicit commercial revision creation, previous-revision preservation and pointer
concurrency; revision-oriented comparison; deterministic private draft PDFs; and
private AI concept asset management/usage foundation. Live AI generation remains
blocked pending provider, budget and data-handling approval. Official company PDF
identity/legal details must be confirmed before document issuance.

The older ADR allowing PM self-approval must be reconciled with the Phase 4
prohibition before Sprint 20 approval code; no approval endpoint is added here.

## Manual checkpoint

Locally create and save a quotation twice, reopen it, inspect both saved versions,
compare changed text/items/totals, and verify existing editing still works. Verify
Sales/Finance access using isolated local accounts. Do not use production data.
Stop for manual results before continuing this delivery. Do not begin Sprint 20.