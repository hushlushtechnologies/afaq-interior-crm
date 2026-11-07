# Sprint 14 — Remaining implementation and acceptance

Status: implementation and numbered file delivery complete; Windows integration and manual acceptance pending.
The owner approved DEC-010 manual checks before authorizing this remaining Sprint 14 work. Sprint 15 is not started.

## Scope and behavior

- Reuses the existing Table, Kanban, forms, shell, design tokens, RBAC and DEC-010 services. No dependency or lockfile changes.
- Server-side literal search across customer name, email, phone, alternate phone, location and numeric reference. Numeric search may also match phone/contact text; it is not an exclusive reference lookup.
- Stage, source, owner/unassigned, priority and inclusive inquiry-date filters; deterministic sorting with null values last and a UUID tie-breaker.
- Page sizes 10/20/50, bounded server pagination, loading/error/empty states and preserved filters while switching Table/Kanban or active/archive views. Browser reload returns to default filters; URL-saved views are outside this delivery.
- Column-heading server sorting, existing column visibility and row actions remain available.
- Stage totals cover the entire authorized filtered result, while cards remain paginated. Hidden leads cannot contribute to totals, owner options or historical source options.
- Current selected owner/source filters remain visibly selected when a view becomes empty. Ineligible remembered assignment targets are displayed explicitly and cannot be newly submitted through the UI.
- Page-only selection, maximum 50 leads. Selection resets on page/query/view changes and after updates.
- Bulk assignment uses existing leads.assign scope. Current Super Admin company assignment is preserved; Sales and Management receive no new grants.
- Each batch validates every record and version, actor/owner eligibility and DEC-010 constraints. Lost/archived records reject the batch; Assigned leads cannot become unassigned until moved out of Assigned.
- Audit, per-lead changes, child receipts and the group receipt commit atomically. A later audit failure rolls back earlier row changes in that batch.
- Exact retries, including reordered selections, return the recorded result without repeating history. Changed input with the same group request ID is rejected. Current authorization is checked before replay.
- Pending/uncertain bulk requests lock selection, filters, paging and dismissal; retries retain the same request UUID, row versions and owner.
- Existing lead CRUD, provenance, Lost/reopening history, quotation/Won gates and final-Super-Admin protections remain intact.

## Migration and safety

supabase/migrations/20261105000400_sprint14_table_bulk.sql

The migration was explained before application to dedicated local Supabase, after a private backup of crm_access, crm_employees and crm_sales. It adds query indexes, a protected query RPC, private RLS-enabled bulk receipts and the controlled bulk RPC. It changes no role grants, existing stage rules or business rows. No reset, table drop, production operation or real external email delivery occurred.

The delivered migration depends on the approved DEC-010 migration 20261105000300. A fresh replay verified it without the earlier unpublished local query draft.

## Verification

- TypeScript, ESLint, formatting, explicit new-config formatting and git diff --check passed.
- Nineteen validation cases passed: six existing lead, five DEC-010, five query and three bulk cases.
- Final sequential npm run test:all passed all 240 browser checks on the delivered UI: 128 production across twelve files, twelve design, fifteen shell and eighty-five prototype. Production build passed through the runner.
- The eight table/bulk desktop/mobile checks include empty-archive owner-filter retention, cross-page counts, accessible controls, stale-batch rollback, concurrent assignment and lost-response retries.
- Fresh disposable managed-platform schema replay applied twelve application migrations and passed all eleven SQL suites. The generated database was removed.
- SQL coverage includes actual authorization boundaries, hidden-count/facet privacy, global stage counts, sorting/date/pagination, no-op/reordered retries, stale/mixed selections, inactive targets, Lost/Assigned restrictions and rollback after the later row's audit failure.
- An initial fresh-replay query test incorrectly assumed numeric reference search could not also match phone text. Its assertion now requires the referenced lead in the results rather than forbidding legitimate contact matches; the corrected suite passed.
- Bounded secret scan: 38 client files and three logs, no configured private-binding matches. This is not a universal security guarantee.
- Post-run generated lead/loss/event/single-receipt/bulk-receipt rows and s09-e2e Auth accounts were zero; existing setup identities were retained.

Cloud browsers used an external installed-Chromium adapter. Windows uses the project's pinned Playwright Chromium. Windows commands, owner manual acceptance, production migrations and production-volume performance benchmarks were not executed. Separate employee unit and Storage HTTP suites were not repeated; related SQL/browser regressions passed.

## Files

New:

- playwright.lead-table-unit.config.ts
- playwright.lead-table.config.ts
- src/components/leads/lead-bulk-assignment.tsx
- src/components/leads/lead-query-controls.tsx
- src/features/leads/bulk-actions.ts
- src/features/leads/bulk-schemas.ts
- src/features/leads/bulk-service.ts
- src/features/leads/query-actions.ts
- src/features/leads/query-schemas.ts
- src/features/leads/query-service.ts
- supabase/migrations/20261105000400_sprint14_table_bulk.sql
- tests/e2e/lead-table.spec.ts
- tests/sql/lead-bulk-assignment.sql
- tests/sql/lead-queries.sql
- tests/unit/lead-bulk.spec.ts
- tests/unit/lead-query.spec.ts
- docs/reports/sprint-14-remaining-implementation.md

Modified:

- playwright.config.ts
- src/app/(workspace)/[...segments]/page.tsx
- src/components/leads/lead-record-workspace.tsx
- src/components/leads/lead-view-context.tsx
- src/components/leads/leads-kanban.tsx
- src/components/leads/leads-table.tsx
- tests/helpers/lead-fixtures.ts

## Commands executed

- npm run typecheck
- npm run lint
- npm run format:check
- Explicit Prettier checks for both new table runner configurations
- git diff --check
- Playwright lead, pipeline and table unit configurations (6 + 5 + 8 passed)
- Focused table browser configuration, then final sequential npm run test:all with the cloud-only Chromium adapter
- All eleven SQL suites after twelve migrations in a generated disposable database
- Bounded client/log secret scan and read-only fixture counts

## Manual checkpoint

Copy all complete files from the three delivery parts before running the final Windows regression. Verify combinations of filters, date bounds, header sorting, page sizes, view switching, column visibility, empty/archive filter retention, stage totals beyond one page and existing row actions.

Using synthetic local records, verify bulk assignment, explicit unassigned handling, stale/mixed-selection rejection with no partial changes, inactive-owner rejection, uncertain retries and preserved assignment history. Recheck DEC-010 stage/Lost/reopen boundaries and existing role/final-Super-Admin protection.

All numbered Sprint 14 implementation files have been supplied; owner acceptance remains pending. Requirements, rooms, site visits and attachments belong to Sprint 15; activities/reminders to Sprint 16; imports/capture/reporting to Sprint 17. Do not start Sprint 15 or Phase 4 before the required approval.