# Sprint 13 — Lead database and CRUD

Status: implementation delivered; Windows integration and owner acceptance pending.
Scope: Sprint 13 only. Sprint 14 and Phase 4 are not authorized by this delivery.

## Audit and prerequisites

Remote main was inspected at 0419556a9a82d60c77741d95ab8013a708f6aa3d. Work used an isolated checkout; the original dirty workspace was preserved. Previously supplied Phase 2 repairs are prerequisites and must not be assumed present on remote main merely because they were delivered in chat.

Reviewed Phase 0 architecture dictionaries, architecture decisions, business workflows, role matrix, traceability and open decisions, plus Sprint 05–12 reports and actual code/migrations. No consolidated Phase 1 closeout or separate sprint tracker was found; traceability supports the approved Sprint 13–17 scope.

Actual stack: Next.js App Router, React, strict TypeScript, Supabase SSR/Auth/PostgreSQL/Storage, Zod, Radix, TanStack Table, dnd-kit and existing theme tokens. Dependencies and lockfile are unchanged.

Before Sprint 13, nine application migrations provided crm_access roles/permissions/audit and crm_employees invitation/profile/status records. No lead/client/opportunity business table existed. Existing grants were preserved: Sales own-create and assigned-view/update; Management company-view; PM assigned-view/update; Super Admin company capabilities. Final-Super-Admin protections remain intact.

## Implemented

- Additive crm_sales sources, inquiries, history and per-actor request receipts.
- Session-based server actions/services, independent database authorization and actual table RLS.
- Validated create/read/update/assign/archive with atomic history, version conflicts, stable retry IDs and no-op assignment handling.
- Nullable unknown contact/property/budget data; exact AED amounts; international phone validation; immutable source/creator/created time/initial note.
- Visible-record duplicate warnings without merging or disclosing inaccessible contacts. Unique source/external identity foundation; ordinary CRUD cannot supply external IDs.
- Existing Table/Kanban components connected to real records through shared context, with 20-row server pagination and loading/error/empty states.
- Create/view/edit dialog, eligible ownership, explicit unassigned state for authorized company assignment, archive confirmation and preserved read-only archived history.
- New leads.archive permission granted only to Super Admin company scope. Existing role grants are unchanged.
- Six validation cases and ten desktop/mobile lead browser cases, rollback SQL coverage and mandatory regression-file discovery.

## Business and security boundaries

Leads represent inquiries, not fabricated clients, opportunities, quotations or projects. Existing prototype stage identifiers remain intact. Real intake stage stays New; generic CRUD cannot change stages or outcomes. Drag/drop and advanced pipeline workflows require Sprint 14 approval.

Ownership uses canonical Phase 2 Auth UUIDs. Active, confirmed, unblocked eligible Sales/Super Admin identities may own inquiries, including eligible legacy accounts without a profile row. Sales create is self-assigned; company assignment may select an eligible employee or unassigned. Creator identity alone does not override assigned-only visibility.

Application roles have no direct INSERT/UPDATE/DELETE access to lead tables or receipt access. Controlled RPCs check live actor eligibility and resource scope. Ordinary service-role access/execute is denied. Normal account deactivation preserves references; assigned-account deletion is restricted. Audit identity UUIDs remain historical evidence.

All history is retained; the dialog displays the latest 50 events. Kanban counts cover the current server page. Follow-up date is an intake field, not a scheduler/reminder. Initial note/history is not the full activity module. Requirements/files remain Sprint 15, activities/reminders Sprint 16, imports/capture/reports Sprint 17. Dashboard remains its existing truthful preview.

Development prototype access requires explicit ?preview=1 and the existing full-demo gate. Production ignores preview mode. Real records never enter fictional demo state.

## Migration safety

Migration: supabase/migrations/20261105000100_sprint13_lead_foundation.sql. Its new schema/tables/indexes/functions/policies and archive grant were explained before local application. Existing local application schemas were privately backed up. No reset, production migration or destructive business-data operation was performed.

Part 4 has no additional migration. tests/sql/leads.sql is a transactional rollback test, not a migration. Tests use generated local fixtures; fixture cleanup targets only identities created by that test.

## Files delivered

New:

- supabase/migrations/20261105000100_sprint13_lead_foundation.sql
- src/features/leads/schemas.ts
- src/features/leads/service.ts
- src/features/leads/actions.ts
- src/components/leads/lead-view-context.tsx
- src/components/leads/lead-record-workspace.tsx
- tests/helpers/lead-fixtures.ts
- tests/unit/lead-validation.spec.ts
- tests/sql/leads.sql
- tests/e2e/leads-crud.spec.ts
- playwright.leads-unit.config.ts
- playwright.leads.config.ts
- docs/reports/sprint-13-implementation.md

Modified:

- src/features/access/catalog.ts
- src/components/demo/demo-crm-provider.tsx
- src/lib/demo/format.ts
- src/components/leads/lead-stage-select.tsx
- src/components/leads/lead-card.tsx
- src/components/leads/leads-kanban.tsx
- src/components/leads/leads-table.tsx
- src/components/leads/lead-details-prototype.tsx
- src/app/(workspace)/[...segments]/page.tsx
- playwright.config.ts
- tests/e2e/prototype.spec.ts

Three baseline files were normalized by the existing formatter without behavior changes: workspace/layout.tsx, features/access/workspace-access.ts and tests/auth.setup.ts. Earlier Phase 2 repairs remain prerequisites; they are separate from the Sprint 13 business implementation.

## Verification evidence

- ESLint, TypeScript, formatting (including both new runner configs) and git diff --check passed.
- Six lead validation cases, eleven employee unit cases and five Storage/local-safety integration cases passed.
- All eight rollback SQL suites passed against local Supabase, including actual authenticated-role RLS, duplicate privacy, protected provenance, inactive actors/assignees, stale edits, retry collisions and atomic audit rollback.
- Fresh disposable schema replay applied all ten migrations and passed all eight SQL suites; the disposable database was removed.
- Sequential npm run test:all exited 0: 226 browser checks passed (114 production, 12 design, 15 shell, 85 prototype). Production checks include ten real local lead browser cases across desktop/mobile, lost create/update responses, accessible CRUD, assignment/archive, pagination and authorization. Production build passed through the runner.
- Bounded secret scan: 38 client files and three test logs checked; no configured private-binding matches. This is not a universal secret/security guarantee.
- Post-run lead rows, events, request receipts, generated s09-e2e Auth accounts and crm-private objects were all zero. Existing setup accounts were retained.
- Cloud browsers used installed Chromium through an external adapter; Windows pinned Playwright Chromium and manual integration remain pending. No package or lockfile changes.

## Windows and manual acceptance

Use D:\Development\afaq-interiors-crm, Docker Desktop, existing Node/npm, existing local Supabase keys and a confirmed Phase 2 test account. No new dependency or hosted Dashboard setting is needed. Confirm project_id afaq-interiors-crm-s09-local and API port 57421 before any fixture test. Local Studio: http://127.0.0.1:57423. Studio owner access does not prove RLS.

Copy every complete delivery file before testing. Run Playwright suites sequentially because existing configurations share artifact directories. Use the supplied PowerShell commands; never run a database reset. No Windows command or user manual check is claimed executed by cloud verification.

Manual acceptance pending: partial/unknown information, persistence after reload, immutable provenance, eligible assignment/unassignment, duplicate warnings without merging, archived history, Sales assigned-only and Management read-only access, stale-edit conflicts, retry behavior, mobile/keyboard layout, disabled stage/outcome controls and unchanged Phase 2 administration. Use synthetic local data only.

No real invitation/email was sent and no production setting or data was changed. No unresolved failure remains in the executed checks. Windows compatibility and owner acceptance remain unverified. This report does not assert universal security or whole Phase 3 completion.

Stop at the manual checkpoint. Explicit Sprint 13 approval is required before Sprint 14.