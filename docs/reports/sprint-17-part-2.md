# Sprint 17 Part 2 — protected employee import workflow

Status: implemented and locally tested; owner manual verification pending.
DEC-011 CSV duplicate/retention policy was approved on 2026-11-12 (Asia/Dubai).

## Delivered

One additive migration creates crm_sales.import_batches, import_rows,
import_events and private import_requests. Authenticated RPCs stage, read and
confirm imports. No existing table, role grant or final-Super-Admin rule changes.
No new package or raw-file Storage bucket is introduced.

The HTTP route /api/leads/imports uses the existing employee session and lead
permissions. POST reparses bounded original CSV bytes, computes SHA-256, rebuilds
normalized rows and stages them. GET reads a private paginated batch. PATCH
confirms its version with an explicit skip selection. Mutations verify Origin.
Responses are private/no-store. Uploads have byte and time limits.

Source and owner checks reuse existing active-source and Sales eligibility
rules. Without company assignment permission, the importing employee must be the
owner. Batch access requires the initiating employee and current lead-create/view
access; managers or other Super Admins cannot read another employee's batch.

Only visible exact email and cross-primary/alternate-phone matches cause review.
No matching customer IDs are returned. Names alone do not match. No duplicate
creation override or merge exists. Every invalid/review row requires explicit
skipping. Invalid raw values are not retained; field-error names are retained.

Confirmation rechecks current eligibility and visible duplicates before any lead
creation. A new match records a review event and version change with zero new
leads. Otherwise all selected lead creations, skips, ordinary lead histories,
batch history and retry receipt commit together. Protected lead creation fixes
initial stage/provenance. Any unexpected failure rolls back the entire attempt.

A shared transaction lock serializes authorized lead/role operations. Exact
actor/request/payload retries replay without new effects. Reordered skip lists
are equivalent; changed input or stale versions fail. An identical staged payload
also reuses its batch when submitted with a new request ID. Current authorization
is checked before returning receipts. Applied row content/lead IDs are redacted
if the importing employee later loses current access to that lead.

Staging limits: five new batches and fifty new staging request IDs per employee
per minute. Exact request retries precede these limits. Part 1 limits remain.
No email, external ingestion, quotation or project operation occurs. Imported
follow_up_on is an intake date, not a scheduled task or reminder.

## Local migration and verification

Verified dedicated project afaq-interiors-crm-s09-local and loopback API 57421.
A private local database backup was taken before applying only migration
20261112000100 with migration up --local. No reset or production access occurred.

- Import parser/contracts: 20 tests passed.
- Existing lead validation: six tests passed.
- All 21 rollback-only SQL suites passed, including the new import fixture.
- Six desktop/mobile authenticated HTTP workflow checks passed.
- Production build passed through the HTTP test runner.
- TypeScript, ESLint, formatting and whitespace checks passed.
- Configured-secret scan found no matches in client artifacts or supplied logs.
- Cleanup verified zero import batches, generated fixture accounts and cron jobs.

Initial build failure from an incompatible explicit runtime export was fixed by
using this Next.js version's default Node runtime. Initial browser login timeouts
were fixed by starting fixture tests without inherited authentication. Final runs
passed. Credential-bearing traces/screenshots are disabled for these tests.

The existing 188-case UI regression, separate shell/design/prototype suites,
actual reminder cron tick and fresh-database bootstrap were not repeated here.
The current module has no import UI yet, so browser form/accessibility review is
pending Part 3. No 500-row production throughput or broad security claim is made.

## Files and checkpoint

New: migration; lead-import/contracts.ts, prepare.ts and service.ts;
api/leads/imports/route.ts; lead-import-staging.spec.ts; import-fixtures.ts;
lead-import-api.spec.ts; tests/sql/lead-imports.sql; playwright.imports-api.config.ts;
DEC-011 decision;
this report. Modified: playwright.imports-unit.config.ts.

Copy complete files and follow the local Windows backup/migration/testing steps.
Keep cron disabled. Verify the SQL results and six HTTP workflow checks before
continuing to the import UI. Sprint 17 is not complete. Phase 4 has not started.

Wider retention rules, XLSX, capture integrations, reports, exports and final
Phase 3 verification remain pending. Original CSVs are not retained. File hashes
are not signed provenance for direct RPC callers. Duplicate visibility limits
and other boundaries are recorded in DEC-011-sprint17-imports.md.