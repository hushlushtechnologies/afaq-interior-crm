# Sprint 18 Part 1 — Audit and exact-decimal foundation

Status: Sprint 18 authorized; financial rules pending. Sprint 18 is not complete.
The new Phase 4 master prompt confirms the owner's Phase 3 acceptance and defers
broader UI/UX redesign. Sprints 19–22 and Phase 5 remain unauthorized.

## Repository and dependencies

- Connected repository: hushlushtechnologies/afaq-interior-crm.
- Fetched origin/main: dc0b74f (Phase 3 Check). Latest local Part 8 files are not
  present in that remote commit; they remain in the accepted local worktree.
- Primary checkout /workspace/afaq-interior-crm is dirty on branch work; preserved.
- /workspace/afaq-phase3-capture is dirty/detached; preserved.
- /workspace/afaq-sprint18 is a separate detached snapshot of fetched main plus
  the accepted Phase 3 overlay. No reset, overwrite of source worktrees or push.
- No environment files copied. Matching installed dependencies reused; package
  and lockfile unchanged. No new library or paid service selected.
- Next 16.4.3, React 19.3.0, strict TypeScript (ES2017 target), Zod 4.6.7,
  Supabase SDK 2.118.0, TanStack Table 8.21.3, Playwright 1.64.1, Tailwind v4.
- Existing Next cacheComponents, partialPrefetching, CSS rules and external
  sharp/pdf-lib configuration preserved. Installed Next TypeScript guidance read.

## Actual architecture and reusable files

- Auth/RBAC: src/features/access/server.ts, permissions.ts, catalog.ts and
  src/lib/supabase/server.ts; existing crm_access eligibility/scope functions.
- Leads: src/features/leads/service.ts, query-service.ts and pipeline-service.ts.
- Requirements/rooms/notes: src/features/lead-details/service.ts and contracts.ts;
  runtime tables crm_sales.detail_records and detail_events.
- Lead Details: src/app/(workspace)/leads/details/[leadId]/page.tsx and
  src/components/leads/lead-details-workspace.tsx.
- Visits/files/activity: lead-site-visits.tsx, lead-attachments/local-service.ts,
  existing crm-private bucket, lead-activity-timeline.tsx and follow-up services.
- UI: src/components/forms/form-field.tsx, existing controls/dialogs/cards and
  src/components/leads/leads-table.tsx for the TanStack foundation.
- Navigation: src/lib/workspace/navigation.ts; /quotations currently resolves to
  the placeholder in src/app/(workspace)/[...segments]/page.tsx.
- Existing pdf-lib is used for attachment validation. Official PDFs remain
  Sprint 19. No AI provider or live generation is selected in Sprint 18.

## Read-only database verification

Inspected catalog/permission metadata only in the dedicated local container
supabase_db_afaq-interiors-crm-s09-local, database postgres. No writes made.
Migration history includes 20261113000200. Inspected crm_sales/crm_capture tables
have RLS enabled. No quotation tables or quotation RLS exist.

Existing quotation grants: Super Admin company; Management/Finance company view;
Sales assigned view/create/update/submit/share; PM assigned view/create/update/
submit/approve/share. Preserve grants and enforce actual resource scopes. Finance
quotation visibility must not grant general Lead Details access. Sprint 18 adds
no approval operation, client delivery, commercial override or archive grant.

## Source documents and gaps

Reviewed TABLE_DICTIONARY_CORE.md sections 7.1–7.4, DATABASE_CONVENTIONS.md,
ARCHITECTURE_DECISIONS.md, PHASE4_DEPENDENCIES.md under docs/architecture;
OPEN_DECISIONS.md, ROLE_PERMISSION_MATRIX.md and REQUIREMENTS_TRACEABILITY.md
under docs/requirements; and the Phase 3 verification/Part 8 reports.

ADR-009 accepts AED initially. ADR-010 accepts no automatic unit conversion but
leaves unit catalog and precision open. DEC-012 leaves numbering, discounts,
tax, rounding and commercial terms open. Proposed dictionary types are quantity
numeric(18,4), price numeric(18,6), money numeric(18,2); formulas remain open.
There is no implemented quotation tax/settings catalog.

Phase 0 describes opportunities; actual runtime uses crm_sales.leads. Reuse the
actual lead/room relationships rather than creating duplicate opportunity data.
Lead qualification_status currently permits only unreviewed. Do not infer
qualification from a stage or requirements completion flag.

No maintained standalone sprint tracker was found. The historical traceability
plan assigns PDF/approval/AI differently; the new owner plan controls: builder
18, revision/PDF/AI foundation 19, approval 20, delivery 21, conversion 22.
The new prompt supplies Phase 3 acceptance after the report's historical manual
checkpoint. Live capture, optional XLSX and deferred scanning keep their limits.
ADR-006 historically permits PM self-approval; reconcile combined Sales/PM cases
with the newer Sales restriction before Sprint 20, not by adding approvals now.

## DEC-012 proposal — not approved

- Numbering: AFAQ-Q-YYYY-000001, Dubai creation year, yearly counter, at least six
  digits, database generated, unique, gaps allowed; never reuse committed refs.
- Precision: quantity four decimals, unit price six, money/discount/tax totals
  two; reject overflow beyond approved database bounds.
- Units: each, m, m2, m3, ft, ft2, lot, hour, day; no conversion. Each requires
  whole quantities; others permit the approved fractional precision.
- Zero values: item quantity positive; zero price allowed; header-only drafts
  may be saved with zero totals.
- Discounts: fixed AED or percentage per line and overall, one mode per level.
  Authorized draft editors may propose up to 100%/remaining subtotal. No new
  approval authority or override is granted.
- Calculation: round quantity-times-price to cents; apply line discount;
  allocate overall discount proportionally across post-line-discount values;
  calculate applicable tax per line; sum final amounts. Monetary rounding is
  half-up to two decimals. Allocate remainder cents by largest fractional
  remainder with stable item-ID ties.
- VAT: owner must confirm company registration and allowed treatments. If
  applicable, propose tax-exclusive prices and explicit standard 5%, zero-rated
  0% or exempt selection; never default all items to taxable. Missing treatment
  blocks saving priced lines. This proposal activates no tax policy.
- Eligibility/ownership: drafts on authorized active New, Assigned, Contacted,
  Requirements or Site Visit leads. Current lead Sales ownership governs assigned
  access; unassigned stays explicit. No inferred qualification, stage change or
  separate quotation-owner override. Lost/archived/Won contexts are read-only.

No legal terms, bank data, TRN, payment schedule or validity defaults invented.
Payment terms and notes are employee-entered draft text. Archive stays disabled.
Illustrative proposal only: AED 100 minus AED 10 line discount, then 10% overall
and applicable 5% VAT yields AED 81 base, AED 4.05 tax, AED 85.05 total.
The current decimal helper does not implement that formula.

## Remaining Sprint 18 plan

1. Record approved financial/unit/eligibility rules.
2. Explain additive private quotation root, revision 1, sections/items, policy
   snapshot, audit, retry receipts and numbering migration; back up before apply.
3. Implement scoped RPCs/RLS, PostgreSQL numeric authority and exact previews;
   ignore browser totals and preserve source leads and final-admin protection.
4. Reuse forms/table/shell for draft list/builder and Lead Details quotations.
5. Test money boundaries, formulas, numbering concurrency, retries, scopes, RLS,
   persistence and lead regressions; deliver complete files and stop for UAT.

## Part 1 delivery and verification

New files: src/features/quotations/decimal.ts, tests/unit/quotation-decimal.spec.ts,
playwright.quotation-unit.config.ts and this report. No existing feature changed.
Only parsing/formatting/exact rescaling are implemented; scale is caller-supplied.
The 36-digit scale and 128-character input bounds are technical resource limits,
not approved quotation precision. No tax, rounding, discount policy or totals.

Passed: 8 unit tests, npm run typecheck, npm run lint, Prettier on the three new
TypeScript/test/configuration files and git diff --check. Docs are excluded by
existing Prettier config. No dependencies or migrations applied.
Not executed: quotation database/RLS/browser/build integration, pricing-policy
checks, Windows commands or production operations. Financial workflow is pending
owner decisions. Existing UI is unchanged; Sprint 18 remains in progress.