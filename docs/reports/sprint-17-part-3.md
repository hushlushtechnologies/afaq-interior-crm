# Sprint 17 Part 3 — protected CSV import UI

Status: implemented and locally verified; owner manual acceptance pending.
Builds on accepted Parts 1 and 2 and approved DEC-011. No new migration,
dependency, role grant, raw-file storage or production setting is introduced.

## Delivered

Leads > Import CSV at /leads/imports. Navigation, search and the server route
require both leads.view and leads.create. Existing assignment scope controls
owner choices; Sales receives only its own eligible owner option.

The existing forms, dialogs, semantic tokens and layout components are reused.
The file picker waits for hydration before accepting a selection. UTF-8 CSV
parsing, explicit column mapping, source/owner/default-date selection and local
preview precede staging. Exact canonical header names can prefill mappings;
other headers require explicit mapping. Changes invalidate the previous preview.
Local preview does not write a batch or leads. Server staging reparses bytes.

Saved batches show paginated rows, counts, field errors, duplicate warnings and
history. Invalid and duplicate rows require explicit skips. Selections survive
pagination. Confirmation states create/skip counts and creates all selected leads
atomically through Part 2. New visible database matches return to review with no
new leads. Completed rows link to currently accessible created leads.

Uncertain upload/confirmation requests retain the original request ID, payload
and file in memory. Mutable controls and dismissal remain locked until the
unchanged request is retried. No automatic mutation retries occur. Known batches
can reopen through their ID or bookmarked URL. Current server access remains
authoritative; batches cannot be opened by another employee, including another
Super Admin. History uses Asia/Dubai timestamps.

## Verification

- All 204 production/Sprint 16/import UI and API regression cases passed; no skips.
- All 15 shell/responsive/accessibility checks passed.
- Import parser/contracts: 20 passed. Existing lead validation: six passed.
- TypeScript, ESLint, project/runner formatting and whitespace checks passed.
- Final production build passed.
- Configured-secret scan found no matches in client artifacts or supplied logs.
- Cleanup verified zero import batches/rows, generated fixture users and cron jobs.
- Focused import checks also passed before the full integrated run.
- CSV mapping, invalid data, duplicate warnings, explicit skips, saved-batch reload,
  pagination, lost responses, current-owner restrictions and denied access passed.
- Import review screens had no detected WCAG A/AA violations in desktop/mobile checks.
- No SQL suite, design/prototype-specific suite or cron tick was rerun in this UI part.
- Existing nonfatal Next listener-count and NO_COLOR warnings remain.

Initial browser checks exposed file selection before hydration and an ambiguous
alert assertion matching Next's route announcer. The picker now waits for
hydration and assertions are scoped to the import sections. No SQL changes were
needed. No production records or real emails were used.

## Limits and pending work

Draft files, mappings, skip selections and retry state are memory-only and are
lost on navigation or refresh. Known batch IDs remain recoverable through the
saved URL. Reload current data explicitly; there is no live push. A new batch
version clears prior skip choices. Original CSVs are not retained by the server.
Previously loaded authorized content is not remotely erased on access revocation.

No batch directory, XLSX import, duplicate override, merging, CSV export, Meta/
website ingestion, dashboard reports, quotations or projects are added here.
Imported intake follow-up dates do not create tasks or reminders. Larger-scale
throughput and production deployment remain separate verification work.

## Files and checkpoint

New: lead-import/client.ts; components/leads/lead-import-workspace.tsx,
lead-import-batch.tsx, lead-import-rows.tsx; tests/e2e/lead-import-ui.spec.ts;
playwright.imports-ui.config.ts; this report.
Modified: lib/workspace/navigation.ts; features/access/workspace-access.ts;
app/(workspace)/[...segments]/page.tsx.

Copy all ten complete files, run supplied Windows checks, then use only synthetic
CSV data for manual verification in the local fixture instance. Keep cron disabled.
Stop for owner results. Sprint 17 and Phase 3 are not complete; Phase 4 has not begun.