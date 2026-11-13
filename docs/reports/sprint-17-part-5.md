# Sprint 17 Part 5 — Lead reporting

Status: implementation delivered; manual verification pending. Sprint 17 and Phase 3 remain open.

## Implemented

- Real default dashboard and `/reports/sales` using existing metric cards and charts.
- Read-only `crm_lead_report(date,date,text)` RPC; no table, role or policy changes.
- Employee sessions only. Intersect dashboard/report scope with lead-view scope per lead.
- Dubai inclusive calendar ranges, at most 366 days; default last 30 calendar days.
- Leads use creation dates. Follow-ups independently use scheduled due dates.
- Current stage, source, owner, monthly creation trend, current Lost reasons and task status counts.
- Archived leads remain counted. Reopened loss episodes remain stored, excluded from current Lost counts.
- Scoped follow-up totals are own-task only; company lead viewers can see the permitted team.
- Overdue/upcoming exclude closed/archived leads and stale/ineligible assignments. Review counts flag stale assignments on active leads.
- Existing development dashboard prototype remains available with `?preview=1` and existing demo authorization.
- No quotation, project conversion, revenue or delivery claims.

## Files

New: reporting migration; lead-reports contracts/service; dashboard lead-report-workspace; SQL and browser report tests; playwright.reports.config.ts; this report.
Modified: existing catch-all workspace route and local lead fixture helper (acquire the existing shared lock before cleanup DML).

## Migration

`20261112000200_sprint17_lead_reports.sql` was reviewed and applied only to dedicated local project `afaq-interiors-crm-s09-local`, after a private local pg_dump backup. The development function was refreshed locally to handle unassigned-owner SQL NULL values correctly. No production changes or resets. No scheduler enabled.

## Verification

- All 22 rollback SQL suites passed, including final-Super-Admin and database authorization checks. Reporting assertions passed (Dubai boundaries, permission intersection, authenticated execution, archived records, owner review, terminal tasks, Lost/reopening history, inactive/revoked denial and execution grants).
- Focused report browsers: 4 passed across desktop/mobile, including scoped counts, dates, empty/error states, unauthorized RPC/page and accessibility.
- Initial browser fixture used outdated CRM RPC parameter names; corrected and rerun successfully.
- Initial broad browser run: 207 passed, one attachment teardown deadlocked against an in-flight gateway. Database logs identified reversed lock ordering in the synthetic cleanup helper. Acquire shared advisory lock 90310001 before cleanup DML; all 8 attachment retests passed.
- Report SQL team assertions now compare baseline deltas in a repeatable snapshot, so unrelated local fixture records do not affect expectations.
- TypeScript, ESLint, formatting and whitespace checks passed.
- Final full browser rerun: 208 passed (4.9 minutes), including production build. No failed tests remain.
- Client-artifact check: 40 built client files and 4 test logs, no matches for configured local admin-key/password bindings. This is not a comprehensive secret audit.
- Windows commands are supplied for the user's local verification; not executed on Windows here.

## Limits and remaining work

These are current record aggregates, not historical stage snapshots or booked revenue. The owner chart counts the creation cohort, not all-time open workload. Archived leads remain in historical counts; their open tasks remain in scheduled status totals but are not actionable overdue/upcoming tasks. No large-volume or long-running memory test was performed. Next.js emitted listener-count warnings during browser test load; these were not treated as evidence of a confirmed memory leak.

Authorized CSV export and final Sprint 17/Phase 3 validation remain pending. CSV import is implemented; XLSX is not approved/implemented. Meta/website live intake remains blocked as documented in SPRINT17_CAPTURE_CONTRACT.md; pure signature tests do not establish end-to-end integration.

Manual checkpoint: compare Sales and Super Admin views, reconcile counts against visible records, change dates, inspect archived/Lost/reopened records, test an unauthorized account and mobile layout. Stop for user results; do not begin Phase 4.