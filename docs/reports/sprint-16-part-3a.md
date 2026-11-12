# Sprint 16 Part 3A — lead follow-up controls

This delivery connects the Part 2 employee-session actions to Lead Details.
No database migration, new dependency, permission grant or production change.

Implemented: create/edit, reasoned rescheduling/cancellation, completion with
actual time/outcome, current-owner reassignment, read-only terminal states,
server-filtered views, 20-row pagination, latest-50 follow-up history, loading,
empty/error states and Dubai timestamps. Existing workspace components remain.
The database remains authoritative for permissions, owner eligibility and retries.

An uncertain submission keeps its command and IDs in the mounted dialog and
locks edits/dismissal until a definitive reply. Refresh/navigation loses that
in-memory request; cross-navigation retry recovery is not implemented.
A new task uses the lead owner from the loaded page, revalidated by the server.
Reload the lead after changing its owner elsewhere. Existing task rows receive
current-owner review flags from the database and require explicit reassignment.

Verification: TypeScript, ESLint, formatting, production build and four local
Playwright desktop/mobile checks passed. Browser checks exercise creation,
reschedule validation, completion, retained history, filtering, committed-but-lost
response retries, single-record persistence and read-only Management access.
Test locators and account-switch setup were corrected before the passing run.
No new SQL/RLS changes were made; the previous 18 SQL suites were not rerun.
The full browser regression matrix was not rerun. Existing nonfatal Next listener
count and NO_COLOR warnings remain. Synthetic local fixtures are cleaned up.

Files: src/components/leads/lead-follow-ups.tsx;
src/app/(workspace)/leads/details/[leadId]/page.tsx;
tests/e2e/follow-up-ui.spec.ts; playwright.follow-ups-ui.config.ts; this report.

Pending Sprint 16: manual activity logging UI, combined timeline using existing
sources, global my/team daily views, further UI authorization/concurrency/
pagination checks and final integrated acceptance. Reliable reminders remain
subject to DEC-009. No email, WhatsApp or reminder delivery is implemented here.

Manual checkpoint: verify local create/edit/reschedule/complete/cancel, owner
change/reassignment, filters/history and restricted access before continuing.
Sprint 17 and Phase 4 are not started.