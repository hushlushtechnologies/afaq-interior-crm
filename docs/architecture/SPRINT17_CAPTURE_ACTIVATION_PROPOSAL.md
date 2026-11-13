# Sprint 17 Part 8 — Local operational lead capture proposal

Status: prepared for explicit project-owner approval. No implementation or authorization change is applied by this document.

## Current status

The owner reports the latest local checks are good. Lead CRUD, pipeline, requirements, visits, private attachments, follow-ups, CSV import, reporting and CSV export are implemented and verified for the approved local scope.

Remaining functional work: operational website/Meta capture. Current verification helpers and SPRINT17_CAPTURE_CONTRACT.md do not provide a receiver, durable inbox, provider retrieval or worker. Full live integration cannot be claimed from signature tests.

XLSX remains optional/unapproved. Malware scanning and broader production file use remain deferred under DEC-025. Quotation/project/AI implementation remains outside Phase 3.

## Required authorization decision

The Phase 3 master plan says: "If any required authentication, authorization or RLS dependency is missing, report the gap and ask for approval before changing Phase 2 code."

TABLE_DICTIONARY_PLATFORM.md sections 2 and 6 describe service principals, bounded delegations, actual executor/accountability records and private integration events. Those structures are not implemented by the current migrations. Ordinary crm_save_lead requires an eligible employee; do not impersonate an employee or broadly enable service-role writes.

## Proposed approved scope for Part 8

1. Add a distinct non-employee service principal authenticated through existing Supabase Auth, with server-only credential bindings. Give it no employee roles, invitations or ordinary CRM grants. Exclude service identities from employee eligibility/assignment and role-grant paths. Preserve all existing employee roles, memberships and final-Super-Admin protections.
2. Add integrations.manage for Super Admin at company scope only. Other existing roles receive no integration-administration grant. Configuration/delegation changes require server authorization and audit.
3. Require an active accountable Super Admin sponsor and explicit connection-specific delegation for lead capture only. Recheck sponsor lead-create/assignment authority, principal activity, connection state, expiry/revocation and configured source/owner at execution. No quotation, project, finance or arbitrary update authority is delegated.
4. Record the actual service executor and accountable human separately. Preserve historical employee creators and own-scope behavior; do not label an automated write as a human action.
5. Implement a private RLS-protected durable inbox and receipt ledger. Verify existing signatures/limits before staging. Persist before success acknowledgment. Enforce connection/event-key uniqueness and changed-body collision rejection. Retrying an event must not create another lead.
6. Persist only required validated inquiry/provider identifiers and hashes, never original HTTP dumps or tokens. Clear queued inquiry fields after confirmed lead creation; retain receipt, provenance and audit metadata. Pending/failed required fields remain private until resolution, with no automatic deletion of unresolved inquiries or business records.
7. Bind source and optional fixed active Sales owner in trusted connection configuration. Default to explicit unassigned when no owner mapping is approved. Incoming bodies cannot choose owner, creator, source or stage. Invalid/inactive configured ownership holds processing for review rather than silently assigning someone else.
8. Add a separate local-only inbox worker using approved local pg_cron infrastructure, once per minute, with bounded batches, leases/recovery and five attempts with bounded backoff before held review. Recheck authority at the business-write boundary. Leave its job disabled at the checkpoint. Existing reminder scheduling approval is not reused as capture authorization.
9. Implement the signed website receiver and Meta challenge/notification receiver against approved connection bindings. Add a fixed-destination Meta retrieval adapter. Test website intake end to end locally; test provider retrieval with synthetic responses and explicitly label that coverage as simulated.
10. Add a protected local review/retry path for held events. Never merge/overwrite an existing lead automatically. Preserve source/external identity uniqueness, traceable history and existing human CRUD behavior.
11. Use isolated local accounts, fixtures, signing keys and provider responses only. No real Meta requests, customer messages, third-party file processing, paid services, production settings or production migrations.
12. Explain migrations before local application, take a local backup, run database/RLS/permission/replay/concurrency and browser tests, deliver complete files in chat with Windows commands, and stop at the manual checkpoint.

## Live activation remains separately blocked

Live Meta requires an approved app/API version, Page/form/platform mappings, permissions/app-review status, privately configured credentials and actual end-to-end retrieval. Website activation requires an approved signing backend and private key provisioning. Never put signing secrets in browser code or chat.

Local simulated provider tests do not establish Meta production readiness. No route/connection should be publicly enabled merely because a local test passes. No Phase 4 work is authorized by this proposal.

## Approval requested

Approve this bounded Part 8 scope, including its service-identity/Phase 2 integration dependency, additive integration-administration grant, private retention behavior and separate local-only capture worker, before implementation begins.