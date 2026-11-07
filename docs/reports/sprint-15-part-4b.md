# Sprint 15 Part 4B — Approved site visits

Status: implementation complete in the cloud checkout; two-batch copy/paste delivery and owner manual verification pending. This report does not mark Sprint 15 complete. Attachments remain the next approved Sprint 15 work; Sprint 16 and Phase 4 are not started.

## Approved policy and migration

Implements docs/architecture/sprint-15-site-visit-policy.md, approved by the owner on 2026-11-07 (Asia/Dubai). No policy reconfirmation is needed.

Migration: supabase/migrations/20261107000300_sprint15_site_visits.sql. It was explained before application to dedicated local afaq-interiors-crm-s09-local. A private application-schema backup was checked before application. A combined migration/fixture preflight rolled back successfully first. Initial preflight caught a missing parenthesized CASE expression in field-length validation; that syntax was corrected before any migration was committed.

- Adds site_visits, visit_events and private visit_requests in crm_sales, with parent/composite FKs, checks, indexes and read-only RLS grants. No existing business rows are rewritten.
- Uses existing active-employee and lead view/update scopes. No new permission system, role grant or final-Super-Admin change.
- Creation is Planned and requires scheduled time. Assignment may be null; a new/changed assignment must be the current eligible active Sales owner, using the existing lead-owner eligibility helper.
- Unchanged historical assignments survive owner changes/deactivation. Planned visits needing assignment review are flagged on read, including overdue planned visits. Completed/cancelled records are never automatically reassigned.
- Completion requires nonfuture actual time and nonblank meaningful outcome. Cancellation requires a reason. Both preserve actor and finalization timestamp. Actual visit time is distinct from the planned appointment time; actual early visits need not be fabricated as equal to their original schedule.
- Completed/Cancelled are terminal for all mutation commands. A database trigger also protects finalized records and identity. Corrections/reopening are not implemented.
- Record mutation, categorized before/after history and retry receipt commit atomically. Exact retries recheck current authorization and return the stored result; changed input cannot reuse a request ID. Stale versions conflict. No-op edits do not fabricate history.
- Lost/archived parents are read-only. Authorized historical reads remain available. Ordinary deletion is unavailable.

## UI and integration

The completed UI adds Site visits to existing Lead Details using the design system, fields, dialogs and status badges. It supports create/edit, current-owner/unassigned selection, location, notes, unverified measurements, observations, completion/cancellation and recent history. Only permitted Planned records show mutation controls.

Timestamp inputs/display use Asia/Dubai; explicit ISO instants are stored. Editing unrelated fields preserves existing scheduled seconds/microseconds. Calendar validity, required evidence and future completion are checked in validation and database operations. The server/database remains authoritative after role, owner or lead-state changes.

The visit list has loading, empty, error/reload and 20-row pagination states. History displays the latest 50 events; complete before/after snapshots remain stored. Older history pagination is not delivered. Actors are shown as You or stable employee UUIDs; the assignment option uses only the authorized lead's current owner context.

One editor/load is active across Details sections. An uncertain mutation locks dismissal and preserves its exact command, visit ID, request ID and version for retry. A hard reload/browser restart does not persist this mounted-page retry state. Successful writes fetch current data rather than replacing it with a potentially old replay snapshot.

No calendars, GPS, routing, reminders or customer notifications are implemented. No dependencies, Storage policies or bucket limits change.

## Delivery batch 1 — Backend and local tests

- NEW supabase/migrations/20261107000300_sprint15_site_visits.sql
- NEW src/features/lead-visits/schemas.ts
- NEW src/features/lead-visits/service.ts
- NEW src/features/lead-visits/actions.ts
- NEW tests/sql/site-visits.sql
- NEW tests/unit/site-visits.spec.ts
- NEW playwright.visits-unit.config.ts
- NEW docs/reports/sprint-15-part-4b.md

## Delivery batch 2 — UI and browser verification

- NEW src/components/leads/lead-site-visits.tsx
- MODIFIED src/components/leads/lead-details-workspace.tsx
- MODIFIED tests/helpers/lead-fixtures.ts
- NEW tests/e2e/site-visits.spec.ts
- NEW playwright.visits.config.ts
- MODIFIED playwright.config.ts

The first batch intentionally has no visible UI on the owner's machine. Copy all batch-2 files before running the new browser configurations; its fixture cleanup must precede browser-created visit records.

## Verification

- Five new validation/timezone tests passed.
- All fourteen rollback-only SQL suites passed. The final site-visit suite verifies allowed/blocked transitions, author/finalization preservation, current/inactive owner rules, review flags, calendar/future/evidence validation, no-op safety, receipt replay, stale versions, audit rollback, actual-role RLS, hidden history, Management read-only access, roleless/inactive rejection, pagination and closed-parent protection.
- Twelve focused desktop/mobile browser checks passed: full lifecycle, validation, owner reassignment/history, same-request retry, stale edits, permitted/hidden visibility, pagination, Lost/archive read-only states and main-region automated accessibility.
- Full sequential npm run test:all passed all 272 browser checks: 160 production, 12 design, 15 shell and 85 prototype. Production builds passed through the runners.
- The final expanded site-visit SQL suite passed after the browser run. Visit/detail/lead/history/receipt and generated Auth fixture counts were zero; existing setup identities were retained.
- Bounded secret scan checked 41 production client files and the final browser log with no configured private-binding matches. This is not a universal security guarantee.
- TypeScript, ESLint, project/runner formatting and git diff --check passed. Production build passed through the focused runner.
- Windows/manual acceptance and production-volume performance were not independently executed. Existing nonfatal Next.js listener warnings are observed; no proven leak/performance conclusion is asserted.

Commands executed: local pg_dump; npx supabase migration up --local; fourteen sequential psql suites; visits unit/focused browser configurations; npm run test:all; npm run typecheck; npm run lint; npm run format:check; explicit runner Prettier; git diff --check; final bounded secret scan and read-only fixture counts.

## Manual checkpoint

Review the migration, verify only the dedicated local target/new pending version, back up schemas and apply locally. Run supplied SQL/unit/static commands for batch 1. After batch 2, verify UI lifecycle, terminal controls, UAE times, current-owner assignment/review, history, concurrency, retries and denied access using synthetic records only.

No real external email, production data/settings or customer files are processed. Regression invitation delivery remains local-fixture/local-viewer only. Attachments are still disabled pending their separately delivered implementation under the already approved DEC-025 policy. Do not begin Sprint 16 before final Sprint 15 testing and owner approval.