# Sprint 16 Part 5A — local reminder foundation

DEC-009 was explicitly approved by the owner on 2026-11-11 for local in-app
follow-up reminders only. The broader scheduler decision remains open for other
modules and production. See the dedicated DEC-009 local decision document.

Implemented: generic recipient-specific reminder records, existing-grant/current
owner eligibility, due-time deduplication, bounded transactional worker batches
of 100, successful-run counts, recipient RLS and protected list/mark-read RPCs
and Server Actions. No browser, email, SMS or WhatsApp delivery was introduced.

Worker eligibility requires an open due task, current active eligible Sales owner,
matching task/lead ownership, a non-Lost/non-archived lead and current lead-view
grants. Read operations recheck these rules, so obsolete or revoked notices are
hidden immediately. Same owner/due combinations do not regenerate notices.
Stored title is generic and contains no customer/task description.

The worker is executable only by trusted database roles; employee/service
execution is revoked. Mark-read is recipient-only, idempotent and serialized
with existing lead/account changes. SQL failures roll back reminder creation
and successful-run logging together. Failed automatic runs must later be
inspected in pg_cron logs; the application table records successful batches only.
Busy ticks skip and rely on a later tick; this is not exactly-once delivery
or an exact-time guarantee.

Migration 20261111000200 installs the available pg_cron extension locally,
restricts cron schema access, adds tables/indexes/RLS/functions, and reloads the
API schema. It DOES NOT schedule a job. Reviewed backup and rollback preflight
preceded local application. No production settings/data were changed.

The bell is still disconnected. Automatic one-minute scheduling and actual
scheduled-run tests remain for Part 5B, along with the reminder UI. No live
reminder delivery or completed Sprint 16 is claimed by this foundation.

The shared cleanup helper now removes reminder children before follow-ups.
Existing room/visit assertions are scoped to their actual sections because
timeline text and filter options made page-wide text matches ambiguous.

Independent browser regression initially returned 183 passes and five ambiguous
selector failures across room/visit cases. Behavior expectations were retained.
The final affected room/visit rerun passed all 20 desktop/mobile cases.

All 20 SQL rollback suites passed, with the reminder suite also rerun after
adding revoked-grant coverage. Two reminder contract tests passed. TypeScript,
lint, formatting, production build and whitespace checks passed. Local cron jobs,
reminder records and generated fixture users were all zero. Client/log secret
checks found no configured binding matches.

This does not constitute an actual scheduled-run test. Part 5B remains required.
Do not enable a cron job during Part 5A verification.
Sprint 17 and Phase 4 are not started.