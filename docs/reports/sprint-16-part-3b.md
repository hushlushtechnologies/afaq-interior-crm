# Sprint 16 Part 3B — manual activity logging UI

Adds protected manual call, meeting, WhatsApp and email logs to Lead Details,
using existing Part 2 actions and RLS. No database migration, new dependency,
permission change, external delivery or production setting change.

The list includes immutable manual logs and existing follow-up completion
activities. It is not the combined notes/site-visit/pipeline timeline. Uses
20-row server pagination, Dubai times, employee/recorded timestamps, nullable
outcomes/notes, loading/empty/error states and read-only access from the server.

Uncertain submissions retain the exact command and request ID in the mounted
dialog; fields and dismissal lock during retries. Refresh/navigation loses
in-memory retry state. Saved activities cannot be edited or deleted in this UI.
Reload recorded activities after completing a follow-up in the adjacent section.

Tests cover all four manual kinds, future-time rejection, unknown optional
information, persistence, pagination, committed-but-lost response retries,
Management read-only access and rejection of unrelated Sales visibility.
Existing follow-up browser checks are included in the focused runner.
No SQL/RLS changes were made; previous SQL suites and the full browser matrix
were not rerun. Existing nonfatal Next listener-count/NO_COLOR warnings remain.

Files: src/components/leads/lead-manual-activities.tsx;
src/app/(workspace)/leads/details/[leadId]/page.tsx;
tests/e2e/manual-activity-ui.spec.ts; playwright.activities-ui.config.ts;
tests/e2e/follow-up-ui.spec.ts; this report. No secrets belong in these files.

Pending: combined timeline, global daily my/team views, remaining UI checks,
reliable scheduler/reminder decision DEC-009 and Sprint 16 final acceptance.
Sprint 17 and Phase 4 have not started. Stop at local manual verification.

A follow-up regression initially clicked Complete during its post-save reload.
The test now waits for persisted version 2 after rescheduling before continuing.

Final verification: 10 focused desktop/mobile browser tests passed, including
four prior follow-up cases and six activity cases. TypeScript, ESLint, project
formatting, explicit runner formatting, whitespace checks and production build
passed. Generated fixture accounts and manual activities were absent after
cleanup. Bounded client/log scan found no configured secret matches.
