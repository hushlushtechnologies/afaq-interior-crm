# Sprint 17 Part 6B — Protected lead CSV download

Status: implementation delivered; manual verification pending. Sprint 17/Phase 3 remain open.

## Delivered

- Approved leads.export catalog entry and role scopes: Super Admin/Management company, Sales assigned; all other roles unchanged.
- Authenticated database RPC intersects export/view scope per lead, rechecks employee eligibility, uses fixed columns and existing table filter/sort semantics, and ignores page boundaries.
- One selected data statement forms the snapshot; current lead ownership, stage, source and inquiry date filters apply. More than 1000 matches fails, with no silent truncation.
- Private RLS-enabled audit table, no direct employee grants, five snapshot accesses per actor per minute, shared lock order consistent with existing role/lead operations.
- Same-origin POST route, bounded 8 KiB JSON with 15-second body deadline, normal employee sessions, no service role, private/no-store responses and safe generated filenames.
- Existing CSV formatter enforces 4 MiB and cell/value limits; reference/budget are strings at the database boundary. No internal notes, descriptions, activities, attachments, owner login emails or credentials exported.
- Export button in the existing filter controls uses applied query props. Unapplied drafts are excluded; all matching rows are considered regardless of current page. Existing lead editors, workspace and design tokens retained.
- Test helper cleans only its generated local export audit rows and preserves shared lock ordering.

New files: migration, export contracts/service/API/button, SQL/browser tests, playwright.exports.config.ts and this report. Modified: access catalog, existing query controls, fixture cleanup helper, starter metadata assertions and export authorization decision. Existing CSV formatter and other business modules retained.

## Migration

20261113000100_sprint17_lead_exports.sql: one additive permission, three grants, one private audit table/index and one protected RPC. Reviewed, backed up and applied only to afaq-interiors-crm-s09-local. No resets, production changes, role memberships or existing business data modified. Scheduler remains disabled.

## Verification

- CSV formatter unit suite: 13 passed.
- Focused desktop/mobile export suite: 6 passed, including concurrent quota, revocation, applied filters, formula escaping, field privacy, anonymous/view-only denial and body limits.
- All 23 rollback SQL suites passed, including export reassignment/inactive-user checks and final-Super-Admin protections.
- TypeScript, ESLint, formatting and whitespace checks passed.
- Initial browser run: 213 passed; one existing 404 assertion failed because two streamed noindex tags matched a strict single-element locator. The assertion now requires at least one directive and verifies every directive includes noindex. No application indexing behavior changed.
- The first focused test run also required fixing test account switching to clear its previous session.
- Final full browser rerun: 214 passed (5.0 minutes), including production build. No failed tests remain.
- Client-artifact check: 40 client files and 4 logs, no configured local admin-key/password matches; not a comprehensive secret audit.
- Windows and spreadsheet-viewer manual checks remain pending.

## Limits

The database audits snapshot access, not a completed browser save. Formatter/network failures can leave a valid snapshot-access event. Every explicit retry is a fresh request; no automatic retry or stored CSV. A later snapshot can reflect later authorized changes. Filters in the private audit may contain customer search terms.

CSV cannot mandate spreadsheet column types or identical behavior across viewers. Validate formula-like test values in the supported viewer and import reference/budget as text when exact display is required. No production-volume load or long-running memory profile performed. Next.js listener-count warnings were observed during test load; no memory-leak conclusion is claimed.

## Checkpoint and remaining work

Verify Sales/Management/Super Admin downloads, unauthorized role denial, applied versus draft filters, sorting, archived/Lost visibility, limits, privacy, and exact file contents using local synthetic records only. Stop for user results. Final Sprint 17/Phase 3 validation remains pending; XLSX is not approved/implemented; live capture remains blocked by its documented dependencies; Phase 4 is not authorized.