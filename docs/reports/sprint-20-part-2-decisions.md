# Sprint 20 Part 2 — revision-specific review decisions

Date: 2026-11-17 (Asia/Dubai).

## Scope and policy

This continues DEC-013's approved independent reviewer and named-PM policy.
The reviewer must differ from the creator, latest saved editor and submitter.
Super Admin and dual-role accounts have no exception. Existing role grants,
general lead visibility and final-Super-Admin protection are unchanged.

The named currently eligible PM can approve, reject or request changes against
the exact submitted revision and saved version. Rejection and changes requested
require meaningful feedback. Recorded expired validity blocks approval.
Approval rechecks authoritative totals, the frozen document/customer snapshot,
lead eligibility and retained image metadata/Storage availability.

One immutable decision is retained per review. Actor-scoped request receipts
make unchanged retries idempotent; changed retries and stale or competing
decisions fail. Transactions lock the draft and request before recording the
decision and terminal review status together.

Pending submissions remain locked. After a terminal decision, the existing
revision service can create a new revision while retaining reviewed content.
The new revision needs its own submission and approval. Old decisions, snapshots,
requirements and selected concept references remain available and immutable.
Draft, review and lead stages stay separate; approval does not deliver a document
or mark a lead Quotation Shared, Negotiation or Won.

## Files

New: supabase/migrations/20261117000200_sprint20_review_decisions.sql.
Modified: src/features/quotations/review-contracts.ts and review-actions.ts.
New: tests/sql/sprint20-decisions.sql.
New: tests/integration/sprint20-decisions.spec.ts.
New: tests/integration/sprint20-review-concurrency.spec.ts.
New: playwright.sprint20-decisions.config.ts and this report.
No packages or UI components were added.

## Migration safety

Both review migrations were first rehearsed in rollback-only local fixtures.
The dedicated local database was backed up to a private custom-format dump
outside Git and the archive's table of contents was verified.
Only 20261117000100 and 20261117000200 were pending and then applied locally.
There was no reset, business table drop, hosted migration or production change.
The new migration replaces the pending-only status constraint and review guards;
it adds the private RLS-protected decision table and decision RPC.
Rollback should use a reviewed forward migration or restore to a separate local
database. Do not delete review evidence or mark migration history reverted.

## Verification

Executed: npm run typecheck; npm run lint; npm run build.
Executed: npx playwright test --config=playwright.sprint20-decisions.config.ts.
Executed: npx playwright test --config=playwright.sprint19-checks.config.ts.
Executed: npx playwright test --config=playwright.sprint19-browser.config.ts.
Formatting was checked for the new and modified TypeScript/config files.

The four Sprint 20 cases passed. SQL assertions cover all three decisions,
feedback validation, independent reviewer enforcement, inactive PM denial,
stale versions, missing retained evidence, immutable history, recorded expiry,
corrected revisions, fresh approval requirements and authenticated raw-table RLS.
Separate concurrent database connections verify duplicate submission/decision
replays and conflicting submissions/decisions with one committed outcome.
Committed race fixtures are deleted by generated IDs in the fixed local database;
temporary trigger disabling and restoration are atomic and fixture-cleanup-only.
Other new SQL fixtures roll back.

All 84 existing quotation/security checks and 22 desktop/mobile browser checks
passed: 110 test cases across the three configurations. TypeScript, ESLint,
production build and the targeted formatting check passed. No test failed.
The existing Next.js MaxListenersExceededWarning remains visible in browser
server output; this is not a load test or proof about memory behavior.
Cleanup verified one baseline Auth user, zero leads, quotations, reviews,
decisions, review files, attachments and Storage objects, with review guards
enabled. Local history contains 38 migrations through 20261117000200.
Hosted checks, new approval UI/browser flows, approval notifications and live
external integration checks were not executed in this backend part.

## Remaining Sprint 20 work and checkpoint

Protected submission controls, PM queue/review UI, private evidence access,
in-app approval notifications and browser tests of those new actions remain.
No new approval UI is exposed in this backend part. Do not submit genuine
business quotations yet; use the dedicated local fixtures at this checkpoint.
Reviewer reassignment/delegation requires an additional approved policy.
No real email, external scanning or paid AI call was made. Existing DEC-025
local validation limitations and blocked live AI dependencies still apply.
Official approved PDF issuance and client delivery are not claimed here.

Stop for local test results and confirmation before the next Sprint 20 delivery.
Sprint 20 is not complete. Sprint 21 remains locked.