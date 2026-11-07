# Sprint 15 Part 2 — Protected detail database and server workflow

Status: backend implementation delivered and verified locally; Windows integration/manual checks pending. Sprint 15 UI, site visits and files are not complete. Sprint 16 and Phase 4 have not started.

## Model and migration

NEW supabase/migrations/20261107000100_sprint15_lead_details.sql

The additive migration was explained before applying it to the dedicated local afaq-interiors-crm-s09-local project. A private crm_access/crm_employees/crm_sales dump was created first. A transaction-only schema/test preflight rolled back successfully before local application.

Three tables are added in crm_sales:

- detail_records: fixed requirements/room/note kinds, each with an exact database-validated field shape, parent lead FK, immutable creator through the controlled workflow, update actor/time and independent optimistic version.
- detail_events: append-only application history with before/after snapshots and actor/time, protected by parent visibility and a composite record FK.
- detail_requests: private actor/request receipts containing the exact input and committed response.

This maps Phase 0 conceptual requirements/rooms to the accepted lead-centric pipeline. Requirements are not duplicated into an invented opportunity: the current lead is the parent. Only one requirements record is allowed per lead; multiple rooms and notes are allowed. Fixed JSON shapes are not arbitrary custom fields. No qualification, quotation or project conversion is implemented.

The lead UUID identifies its requirements record; rooms/notes use separate stable UUIDs. IDs are scoped to the parent lead. Creation uses a null record version; edits require the current version. A second creation attempt with a different request ID conflicts rather than overwriting. Exact retries return the stored response, including the original committed version. New requests that do not change data do not fabricate history or increment versions.

The migration adds SELECT-only RLS policies and two authenticated-only public RPCs. No ordinary client writes, receipt reads, business deletion, schema reset, role grant, Stage/Storage policy change or production operation is introduced. Existing source/creator/stage/initial evidence and parent lead versions remain intact. Requirement budget is separate collected information; it does not overwrite the intake estimate or create quotation values.

## Authorization and transactions

- Reads require an active authenticated employee and current leads.view scope on the parent.
- Writes require both leads.view and leads.update scope on the parent.
- Sales can edit their own notes. Editing another author's note requires existing company-wide leads.update permission; original authorship is retained.
- Lost/archived leads are read-only for new mutations; their detail/history records remain readable to authorized employees.
- Current authorization is rechecked before receipt replay. A different payload cannot reuse the same actor/request ID.
- Existing eligibility/role-change locking and a parent-row lock serialize mutation checks. Record change, history and receipt commit together; injected history failure rolled them all back.
- Shared application-wide locking follows the current lead services. Production-volume throughput has not been benchmarked.

## Services and response contract

Server Actions validate unknown input and use the existing permission engine. The server-only service calls Supabase with the employee session, without a service key. Known validation/authorization/conflict failures are non-retryable; an unconfirmed result retains the retry-same-request instruction. The future UI must preserve the exact command while retrying.

The read RPC returns 20 records per page, deterministic creation/UUID ordering (room sort_order first), the total matching count and the latest 50 history events for the selected kind. Older history is retained in the database; full history pagination is not delivered here. Empty pages retain totals. Author UUIDs are returned; employee-name presentation belongs to the UI delivery.

## Verification

- Thirteen detail validation/response-contract tests passed.
- All twelve SQL suites passed: database authorization, private Storage, invitation requests, employee status, last Super Admin, invitation recovery, security audit, leads, pipeline, queries, bulk assignment and lead details.
- New SQL coverage includes real authenticated database-role RLS, hidden detail/history denial, Management read-only access, roleless/inactive denial, strict database validation, repeated room names, pagination, conflicting creation, stale updates, exact/no-op retries, revoked-visibility replay, note authorship, transactional audit failure and Lost/archive protection.
- TypeScript, ESLint, project formatting, explicit new-config formatting and git diff --check passed.
- Production build passed after preserving generated .next output and performing a clean build outside the sandbox. The initial sandbox build and cached retry failed with a Turbopack worker-port EPERM; the clean retry resolved it without application/config changes.
- Bounded client/build-log secret scan found no configured private-binding matches. This is not a universal security guarantee.
- Local migration ledger contains 20261107000100. Detail records/events/receipts and generated s15 fixture-account counts were all zero after rollback-only tests.
- Windows commands and browser submission/UI tests were not executed. Existing 240 browser regressions were not repeated for this backend-only delivery; final integrated browser verification remains pending.

Commands executed: local schema pg_dump; npx supabase migration up --local; npx playwright test --config playwright.lead-details-unit.config.ts; twelve sequential local psql suites; npm run typecheck; npm run lint; npm run format:check; targeted Prettier and ESLint checks; git diff --check; npm run build; bounded secret-artifact scan and read-only fixture counts.

## Files supplied

- NEW supabase/migrations/20261107000100_sprint15_lead_details.sql
- NEW src/features/lead-details/contracts.ts
- NEW src/features/lead-details/service.ts
- NEW src/features/lead-details/actions.ts
- NEW tests/sql/lead-details.sql
- NEW tests/unit/lead-detail-contracts.spec.ts
- MODIFIED playwright.lead-details-unit.config.ts
- NEW docs/reports/sprint-15-part-2.md

Part 1 schemas/tests remain required and unchanged.

## Manual checkpoint and remaining work

Review/copy all complete files, verify the dedicated local project and pending migration list, back up local application schemas, then apply only the explained local migration. Run the supplied SQL/unit/static/build commands and inspect the new schema/RLS in local Studio. No visible requirements editor is expected yet.

Part 3 connects the existing Lead Details hierarchy to requirements, rooms and internal notes. Site-visit workflow and private attachments remain subsequent Sprint 15 work. Child archive controls are not delivered in this save-only backend part; ordinary deletion is unavailable. Unit-catalogue/mandatory-checklist decisions remain explicit dependencies rather than invented rules. DEC-025 content/quarantine policy remains unresolved; uploads are still disabled and the Phase 2 private bucket guards remain unchanged.

Stop at this backend manual checkpoint. Sprint 15 is in progress, not approved or complete.