# Sprint 19 Part 2 — Commercial draft revisions

## Delivered

Authorized employees can create a new commercial draft revision with a mandatory
reason. The operation copies the latest saved document and authoritative totals,
records its predecessor and creator, advances the current pointer and global saved
version atomically, and retains all earlier snapshots. Later draft saves retain
their actual commercial revision number.

The form opens on a dedicated protected route. Navigation from the builder uses a
document link so its existing unsaved-change warning can run. Unknown outcomes
freeze the reason and retain the original request ID for retry. Known conflicts
require reloading the latest saved draft. Existing permissions remain authoritative.

## Files

New: 20261114000200_sprint19_revision_creation.sql; revision-contracts.ts;
revision-actions.ts; quotation-revision-creator.tsx; the quotation revisions/new
page; quotation-revisions SQL, unit and browser tests;
playwright.quotation-revisions.config.ts; this report.

Modified: quotation contracts.ts; the existing quotation detail page;
playwright.quotation-unit.config.ts. No dependencies or environment keys added.

## Migration

Applied only to the dedicated local Supabase project on port 57422 after creating
a private database archive outside Git and verifying its directory. No restore
drill was performed. The migration permits positive draft revision numbers, adds
a foreign key to existing revision provenance, extends two checked fragments of
the installed save function, and adds the authenticated creation RPC. Its guard
aborts the transaction if the required save-function fragments differ.

The existing saved-evidence triggers and table grants remain intact. The request
ledger and advisory-lock namespace are shared with draft saves, preventing
cross-operation request-ID reuse. No applied earlier migration was rewritten.
Production changes and destructive rollback were not performed. Use a reviewed
forward migration for subsequent database repairs.

## Executed checks

- TypeScript, ESLint, changed TypeScript/config formatting and diff checks pass.
- Quotation units: 40 passed, including five new revision contract tests.
- Existing quotation database selection: six passed.
- New revision desktop/mobile selection: six passed. Includes actual API races,
  identical concurrent retries, stale saves, unauthorized access, committed
  Server Action response loss, preserved snapshots, cross-revision comparison,
  viewport overflow and Axe checks on the new form.
- Existing quotation browser selection: eight passed after production build.
- Existing history browser selection: four passed after production build.
- Rollback-only SQL checks passed for revisions, history, last-super-admin,
  database-authorization, leads, lead-pipeline, lead-details and security-audit.

Initial checks caught a required PageHeader description, a Playwright fixture
callback name interpreted as a React hook, and an ambiguous latest-save selector.
These were corrected before the passing final checks. Existing Next.js listener
and NO_COLOR warnings remain visible. Windows commands and owner manual checks
were not executed here. The entire Phase 3 browser suite was not rerun.

## Boundaries and manual gate

All newly created revisions remain Draft. This part does not implement approval,
delivery, official PDFs, live AI generation, lead-stage changes or project creation.
Immutable approved-revision enforcement will be integrated when approval states
are introduced; no approved state is accepted by this draft-only contract.

Remaining Sprint 19 work includes deterministic private draft PDFs and private AI
concept asset management/usage. Official company document details need confirmation;
live AI requires an approved provider, budget and data-handling policy.

Manually create Revision 2 from a saved local quotation, edit it, compare it with
Revision 1, and verify earlier snapshots remain unchanged. Check stale-tab and role
restrictions using isolated accounts. Stop for the owner's results. Sprint 19
remains in progress; do not begin Sprint 20.