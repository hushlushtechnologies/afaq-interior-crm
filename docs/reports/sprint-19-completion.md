# Sprint 19 — final local validation and acceptance report

Date: 2026-11-17 UTC
Status: internal draft/revision/reference scope delivered and locally verified;
owner acceptance pending; external AI scope blocked. Sprint 20 is not authorized.

## Repository and environment

Remote main was fetched and remains 025d9aa. The tested working checkout also
contains the later copy/paste Sprint 19 deliveries as uncommitted files/changes.
These results do not establish that another checkout or hosted deployment contains
the same files. Existing changes were preserved; nothing was reset, committed or pushed.

Tests used only afaq-interiors-crm-s09-local: API 127.0.0.1:57421,
database container supabase_db_afaq-interiors-crm-s09-local on port 57422,
and temporary browser server 127.0.0.1:3100. Hosted Supabase/Vercel were not
modified or validated. No real emails, external AI requests or paid calls were made.

## Delivered and verified

| Capability | Result |
| --- | --- |
| Saved draft history and exact financial/input comparison | Verified with resource authorization and retained snapshots |
| Explicit commercial revisions with reasons | Verified with predecessor links, atomic pointers and preserved previous saves |
| Concurrent numbering/revisions, retries and optimistic edits | Verified against actual local PostgreSQL and browser workflows |
| Internal English draft PDFs | Verified A4 pagination, saved version/revision, totals, draft labels and excluded internal notes |
| Private draft PDF storage/downloads | Verified non-overwriting uploads, cleanup, access audit, authorization and signed expiry |
| Existing-image concept references | Verified lead/room association, selection, archive/history and private PNG/JPEG/WebP preview |
| Existing permissions, RLS and final-Super-Admin protections | Regression checks passed; no permission-engine or role changes |

Saved versions and commercial revisions remain distinct. Saved evidence is immutable.
Concept selection is internal metadata; it grants no client-sharing approval and
does not insert images into PDFs. Source images remain after reference archiving.

## Test results

- playwright.sprint19-checks.config.ts: 84 passed, zero failed on final run.
- playwright.sprint19-browser.config.ts: 22 passed across desktop/mobile.
- Combined: 106 passed. The database checks include 500 synthetic cross-engine
  pricing samples and actual concurrency tests; these samples are not 500 extra cases.
- TypeScript, ESLint, selected-file formatting and git diff checks passed.
- The browser suite ran npm run build and npm run start successfully with PDF,
  concept and local attachment features enabled together.
- Focused accessibility/overflow checks passed for the new concept interface.
- Desktop PDF testing verified actual Storage rejection after signed-link expiry.
- Fixture cleanup verified one baseline Auth user and zero leads, quotations,
  PDF records, concept references/events, attachments and Storage objects.
- Both immutable PDF/concept audit triggers remain enabled.

The initial checks found one outdated assertion in tests/sql/database-authorization.sql.
It assumed the newly introduced crm_draft_pdf_gateway was employee-callable.
The replacement assertion requires authenticated access to be denied and service_role
access to be granted, matching the reviewed server-only gateway. No database grants
or Phase 2 implementation changed. All checks passed after correcting that expectation.

## Migration state

All 36 local migration versions match their migration-history entries through
20261116000300. No migration, repair, reset or data backfill was run in this final part.
Earlier local application used reviewed additive migrations and local backups.

Sprint 19 history includes 20261114000100, 20261114000200, 20261114000300,
20261116000100, 20261116000200 and 20261116000300. The historical 20261114000200
file is empty in inspected main; the later 20261114000300 forward repair supplies
the verified revision implementation. Do not rewrite applied migration history.
History parity alone is not proof of schema correctness; actual RPC/constraint tests
were executed. Fresh-database bootstrap and backup restoration were not tested here.

## Blocked, deferred and limited scope

- Live AI generation remains blocked by DEC-021: provider/model, current pricing,
  budget, credentials and external-processing approval are not configured/approved.
- Existing references are not claimed as provider-generated assets. Provider job
  provenance, billable usage reconciliation and enforced quotas are not implemented.
  Approximately 50 images/month remains planning only; unknown cost is not zero.
- PDFs are English/WinAnsi internal drafts only. Unsupported glyphs fail clearly.
  Official company identity/legal/bank details and approved issuance remain future work.
- Approved/submitted revision locking and approval-specific concurrency belong to
  Sprint 20. No approved quotation or actual client-delivery record was fabricated.
- Client delivery, responses and negotiation belong to Sprint 21; atomic Won/project
  conversion belongs to Sprint 22. Existing gated lead stages remain protected.
- Preview/download bearer URLs can remain usable until their 60-second expiry after
  access changes. Already downloaded copies cannot be recalled by expiring a URL.
- DEC-025 remains local validation only; no malware-free or scanning claim is made.
- Next.js emitted non-failing MaxListenersExceededWarning messages. They were not
  suppressed. Long-running memory/load behavior has not been assessed.
- Full Phase 3 browser regression, hosted end-to-end testing, production-volume
  testing and disaster-recovery drills were not run in this final validation.
- Owner Windows/manual acceptance and production deployment approval remain pending.

## Sprint 20 readiness boundary

Before approval implementation, reconcile ADR-006/DEC-013 author-PM/dual-role and
delegation rules with the latest Phase 4 prohibition on Sales self-approval.
Do not silently add Super Admin commercial overrides. Define exact-version submission,
locking, decision concurrency, resubmission and notification behavior in Sprint 20.
This report neither resolves those decisions nor authorizes the next sprint.

## Owner acceptance checkpoint

Copy the final validation files and corrected SQL test, then run the Windows commands.
Confirm local migration parity, quotation editing/history/revisions, an English draft
PDF download, concept preview/selection/archive and authorized/denied access.
Confirm acceptance of the documented blocked/deferred scope. These cloud results
do not substitute for verification of the manually integrated Windows files.

SPRINT 19 IMPLEMENTATION DELIVERED WITH DOCUMENTED BLOCKED EXTERNAL SCOPE.
AWAITING YOUR FINAL TEST RESULTS AND EXPLICIT ACCEPTANCE.
DO NOT START SPRINT 20 WITHOUT SEPARATE EXPLICIT APPROVAL.