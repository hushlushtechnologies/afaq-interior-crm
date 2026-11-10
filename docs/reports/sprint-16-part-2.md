# Sprint 16 Part 2 — protected follow-ups and manual activity persistence

Implemented and tested on 2026-11-10. Owner verification is pending.

## Scope

- Additive migration 20261110000200 creates follow_ups, manual_activities,
  follow_up_events and private sales_requests receipts in crm_sales.
- Normal employee-session RPCs and Server Actions reuse leads.view/update,
  existing own/assigned/company scopes, and existing eligible_owner checks.
- No role catalogue, final-Super-Admin protection, Storage policy or production
  setting was changed. No real communication or external provider was used.
- Follow-ups must be assigned to the current active Sales owner. Owner changes
  preserve assignments and flag open tasks for explicit reassignment. Reschedule
  and completion require that relationship to remain valid. Authorized
  cancellation can resolve stale assignments without rewriting their history.
- Open tasks can be edited, rescheduled with a reason, completed with nonfuture
  actual time/outcome, or cancelled with a reason. Terminal records are immutable.
- Completion atomically writes one linked follow_up activity, event and receipt.
  Composite foreign keys prevent linking a different task's completion evidence.
- Manual call/meeting/WhatsApp/email logs are immutable employee records, not
  delivery confirmation. Existing notes/site visits/audit sources are retained.
- Exact retries use the same actor/request ID and unchanged payload; changed
  reuse is rejected. Current permissions are checked before receipt replay.
  Versions reject stale writes; no-ops create no business event. Shared advisory
  locking follows existing lead mutation serialization and may limit throughput.
- Reads support 20-row pagination, all/open/today/overdue/upcoming/completed/
  cancelled views and my/team visibility. Global team requires company-wide
  leads.view; per-lead reads use parent visibility. Dubai dates and server time
  drive filters. Today and overdue may overlap; exact due time is upcoming.
- Per-lead reads include the latest 50 follow-up events; older events remain
  stored. Global pages do not return event history. Manual activity pages are
  separate; the combined historical timeline is not implemented in this part.
- Input timestamps support up to six fractional digits to match PostgreSQL.

## Local migration safety

Verified the dedicated afaq-interiors-crm-s09-local configuration, local Docker
daemon and ledger through 20261110000100. Created a nonempty local CRM-schema
pg_dump backup, reviewed the additive SQL, preflighted it in a transaction with
ROLLBACK, then applied only with `supabase migration up --local`.
No reset, destructive migration, production push or remote project modification.
The deferred completion foreign key permits transactional synthetic-fixture
cleanup; application roles have no direct write/delete privileges.

## Executed verification

- All 18 tests/sql/*.sql rollback suites passed, including existing role,
  final-Super-Admin, invitation, RLS, lead, visit and attachment protections.
- The follow-up suite covers ownership/reassignment, eligibility, reasons,
  terminal states, malformed/forged input, read-only leads, RLS, restricted team
  visibility, replay after revoked access, no-ops, stale versions, atomic failure
  rollback, pagination, Dubai boundaries and completion evidence linkage.
- `npx playwright test --config playwright.follow-ups-unit.config.ts`: 11 passed.
- `npx playwright test --config playwright.follow-ups.config.ts`: 1 passed using
  real local Auth/PostgREST. Competing edits yielded one success/one stale result;
  concurrent identical completion retries produced one activity and one replay.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, explicit new
  Playwright-config formatting, `git diff --check`, `npm run build`: passed.
- Existing `playwright.visits.config.ts`: 12 desktop/mobile browser tests passed.
  Cloud Chromium adapter was used; Windows uses installed Playwright Chromium.
- Bounded scan: 40 client files and 2 logs, no configured secret matches.
- Generated follow-ups, activities, follow-up events, receipts and fixture users
  were absent after cleanup. No business fixtures were retained.

Existing nonfatal Next listener-count and NO_COLOR warnings remain visible.
The complete 284-test browser matrix was not rerun for this backend-only part.
No browser follow-up UI submission is claimed: that UI is not connected yet.

## Files and checkpoint

New: migration; features/follow-ups/contracts.ts, service.ts, actions.ts;
tests/sql/follow-ups.sql; tests/integration/follow-up-workflow.spec.ts;
playwright.follow-ups.config.ts; this report.
Modified: features/follow-ups/schemas.ts, tests/unit/follow-up-contracts.spec.ts,
tests/helpers/lead-fixtures.ts. No dependency installation is required.

Copy the complete files and run the supplied local Windows verification commands.
Expect no new visible follow-up controls yet. Keep existing lead/visit workflows
working. Report the local results before the next UI delivery.

Still pending in Sprint 16: manual activity/follow-up UI, combined timeline,
daily views, approved reliable reminders (DEC-009 scheduler decision remains
open), integrated acceptance. No scheduler, notification, email, WhatsApp delivery
or live reminder is implemented here. Sprint 17 and Phase 4 are not started.