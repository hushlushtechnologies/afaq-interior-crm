# Sprint 18 — Quotation UI and implementation checkpoint

Status: implementation delivered; manual Windows acceptance is pending.
Sprint 19 remains locked until explicit approval.

## Implemented

- Protected /quotations list with server-side search, owner/status filters,
  numeric amount sorting, stable pagination, empty/loading/error states and actions.
- Protected /quotations/new?leadId=... and /quotations/[quotationId] builder.
- Customer/property snapshot, current owner, authorized requirement summary and
  active room options. Finance quotation access does not grant lead access.
- Editable sections, custom units, ordered items, quantity, price, line/overall
  discounts, explicit tax treatments/rates, manual VAT number and separate notes.
- Decimal-safe previews; PostgreSQL independently recalculates every saved total.
- Unknown save outcomes freeze editing and retain the original request/payload.
  A lost-response test commits a real local save, retries and verifies one record.
- Saved routes are revalidated; related lists refresh on browser Back navigation.
- Lead Details integration and existing Approval queue/Document templates
  placeholders preserved. No approval or delivery action is introduced.
- Existing design components/tokens reused; broader UI/UX redesign is deferred.
- Text payload preflight leaves room under the Server Action request-size limit.

## Migration and files

20261113000600 adds authenticated quotation-page and builder-context read RPCs.
It changes no existing records, roles, Storage settings or final-Super-Admin rule.
The dedicated local project/container and port 57422 were verified. A private
local database archive was created outside Git and its directory verified before
applying the additive migration. A restore drill was not performed.

New files: the migration; query-contracts.ts, queries.ts and server-render.ts;
quotation-builder.tsx, quotation-list.tsx and lead-quotations.tsx; the quotation
index/detail/loading routes; quotation-queries.sql; quotations.spec.ts;
playwright.quotations.config.ts; this report.
Modified: quotation actions.ts, the existing Lead Details page and the Finance
assertion in quotation-drafts.sql. Earlier applied migrations remain intact.

## Verification

- Production build, TypeScript, ESLint, source/config/test formatting and diff check pass.
- Quotation unit selection: 31 passed.
- Quotation database selection: 6 passed, including 505 cross-engine comparisons.
- Quotation desktop/mobile selection: 8 passed, including real Server Actions,
  lost-response retries, Back navigation, authorization, pagination, errors,
  builder Axe accessibility checks and viewport overflow checks.
- Existing Phase 3 selection: 192 passed initially; 22 invitation-delivery tests
  required the disabled local-only delivery flag. All 22 passed on focused rerun.
  These are split-run results, not a single clean 214-test run.
- Existing SQL suites pass: last-super-admin, database-authorization, leads,
  lead-pipeline, lead-details and security-audit.

Initial browser selectors targeted a heading, the route announcer or an inactive
route field; corrected to named sections and visible roles. Fixture teardown now
has a separate timeout. Three earlier timed-out fixtures were identified and
removed by actual Auth IDs; an earlier email-suffix lookup matched no accounts.
Final verification found zero quotation/draft/save/request/lead fixture rows and
the original single Auth account. Numbering counters are not rewound; gaps remain.

The sandbox's failed Turbopack cache was preserved and a fresh permitted build
passed. Cloud tests used installed Chromium; Windows commands were not executed.
Existing Next.js listener-count and NO_COLOR warnings remain nonblocking.

## Boundaries and manual gate

No production migration, real email, external paid service, destructive reset,
ordinary business-record deletion, quotation approval, PDF issuance, negotiation,
Won conversion or project creation was performed. Local invitation regressions
used the existing isolated email viewer and guarded test-recipient workflow.

Draft tax inputs/TRN are not registry-verified or an approved production tax
catalog. Official issuance and Project Manager review assignment remain later
workflow dependencies. Quotation archiving has not been approved and is absent.
No claim of production readiness, zero bugs or universal accessibility is made.

Manually verify creation, edits, sections/items, correct totals, reloads, related
lists, role restrictions and unchanged Leads workflows in the local VS Code app.
Stop after Sprint 18. Do not start Sprint 19 until the owner explicitly approves.