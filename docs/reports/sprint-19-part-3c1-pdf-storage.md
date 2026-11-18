# Sprint 19 Part 3C1 — protected draft PDF storage foundation

## Scope

Based on main 025d9aa and the Part 3A/3B PDF foundation. Adds only a private
PDF bucket, artifact metadata, protected audit evidence and a service-role gateway.
No role grants, financial changes, approval, delivery or lead-stage changes.
No dependencies or environment variables are added in this part.

The gateway reuses the existing quotation visibility scopes and active employee
eligibility. A future server entry point must obtain the actor from verified
getUser(), never browser input. Only service_role has gateway execution permission.
The application entry point remains local-only until separately approved.

## Migration

20261116000100_sprint19_draft_pdf_storage.sql is additive and transactional.
The new crm-quotation-drafts bucket is private, PDF-only and limited to 10 MiB.
Existing buckets are unchanged. An existing bucket ID causes failure for review.
Restrictive policies block direct employee/anonymous Storage operations even when
a broad permissive policy exists. Artifact/event tables have RLS and no client grants.
An artifact references an actual immutable saved quotation version.

Reservations preserve the actor/request ID and exact hash, size, page count and
template. Matching retries reuse the reservation. Mismatches fail. Actor reservations
are serialized and capped at five new requests per minute. Finalization requires
matching Storage size/MIME metadata and produces one generation audit event.
Cleanup cannot turn ready artifacts into failed artifacts. Failed reservations
are terminal; a confirmed failed request needs a new request ID.

The trusted server must validate actual PDF bytes/hash, upload without overwrite,
and perform physical cleanup. SQL alone does not validate stored PDF content.
Download authorization and issuance recheck current access. The future service must
commit the issuance audit before returning a short-lived URL. This is access
issuance evidence, not proof that a user downloaded or read the file.

## Verification and limits

The new integration test rehearses the migration when absent inside its rollback
transaction. It never marks migration history applied. Synthetic Storage rows have
metadata only; this is not an end-to-end Storage HTTP test or a generated-file upload.
All fixtures, rehearsal DDL and temporary broad test policies are rolled back.

Passed: one new SQL integration test, 21 PDF/model tests, 40 existing quotation
unit tests, TypeScript and ESLint. Database cleanup verified against the fixed local
container: one baseline Auth user, zero leads/quotations, no rehearsal PDF bucket/tables.
Production build was attempted twice, including outside the command sandbox. Both
were blocked by the cloud environment denying the Turbopack CSS worker's port bind.
This delivery does not claim a passing build; Windows build verification is pending.

Real simultaneous network retries, Storage HTTP enforcement, signed URL expiry,
partial upload cleanup and browser accessibility remain Part 3C2 verification.
The PDF button, server workflow and download UI are not connected in this delivery.
Hosted Supabase and Vercel are unchanged. No real emails or external AI calls.
Sprint 19 remains open. Sprint 20 has not started.

Before persistent local application: review SQL and local migration history, verify
the fixed local project, and create a local backup outside the repository. Do not
apply to hosted Supabase. For rollback after artifacts exist, preserve the private
objects, metadata and audit evidence; do not drop tables or delete business history.