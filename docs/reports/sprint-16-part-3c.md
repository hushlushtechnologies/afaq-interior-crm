# Sprint 16 Part 3C — combined lead activity timeline

Adds a protected read-only projection over existing lead, detail, site-visit,
follow-up and manual activity history. Requirements/rooms/notes use their existing
history events. No duplicate history storage, role changes, final-Super-Admin
changes, dependency installation or external communication.

Migration 20261111000100 adds only crm_lead_timeline. It verifies current parent
lead visibility and uses one stable statement snapshot for count/page reads.
Existing RLS and write services remain unchanged. Only authenticated execution
is granted; anon and service_role execution are revoked.

20-row pages sort by recorded timestamp and source-prefixed ID to break ties.
Actual communication/follow-up times are separately shown. Evidence preserves
source values. New events can shift offset page boundaries; reload returns page
one. Older events remain accessible. Follow-up completion uses its audit event;
the linked completion activity is excluded to avoid showing it twice.
Attachments retain their separate audit section. Timeline reload is explicit
following mutations elsewhere. No claim of automatic live refresh is made.

Local safety: verified afaq-interiors-crm-s09-local and ledger 20261110000200,
created a nonempty local CRM-schema backup, preflighted SQL with ROLLBACK,
and applied only with migration up --local. No reset or production migration.

Verification: all 19 local SQL rollback suites passed. New SQL covers timestamp
ties, pagination/counts, archived visibility, unrelated/inactive denial, bad
pages and grants. Two desktop/mobile browser checks passed against all five
sources, retained note evidence, completion deduplication and Management reads.
TypeScript, ESLint, formatting, production build and whitespace checks passed.
Bounded scan of 40 client files and one log found no configured secret matches.
Generated fixtures were absent after cleanup. Full browser regression was not
rerun; existing nonfatal listener-count and NO_COLOR warnings remain.

Files: migration; src/features/lead-timeline/contracts.ts and actions.ts;
src/components/leads/lead-activity-timeline.tsx; lead details route;
tests/sql/lead-timeline.sql; tests/e2e/lead-timeline.spec.ts;
playwright.timeline.config.ts; this report.

Manual checkpoint: verify combined evidence, reload and pagination locally.
Global daily my/team views, reliable scheduler decision DEC-009, reminders and
Sprint 16 final acceptance remain pending. Sprint 17/Phase 4 are not started.