# Sprint 15 attachment UI — local implementation and delivery

Scope: DEC-025 local attachments within Sprint 15. Sprint 16 is not authorized.

## Implementation

- Lead Details connects the existing FilePicker and preview components to a private attachment panel.
- Upload, download and removal use the local server-only gateway with current Auth/RBAC/resource checks.
- Uploads require an exact Content-Length, at most 10 MiB, bounded body reads and actual byte validation.
- Same-origin checks protect POST/PATCH. Responses use no-store and nosniff headers.
- Migration 20261107000500 adds a private database counter: 10 upload attempts per employee per one-minute window, before body parsing.
- UUID request identity and the selected File survive uncertain retries while the panel stays mounted.
- A later rejection after an uncertain response does not discard that original request identity.
- Progress distinguishes sending bytes from server validation. Duplicate filenames use independent object identities.
- Downloads use authorized, audited 60-second links; PDFs are downloaded rather than rendered as application HTML.
- Removal requires confirmation and existing leads.archive permission; historical metadata remains visible separately.
- Existing lead details, site visits, roles, final-Super-Admin rules and private bucket restrictions are preserved.

## Local-only operation

Keep ENABLE_LOCAL_LEAD_ATTACHMENTS=false until all delivery batches are integrated.
Enable it only in the dedicated local .env.local after integration, then restart Next.js.
The automated local test server enables it for its isolated fixtures only.
No production migration, production setting, real invitation, customer upload or external scanning service is used.

## Verification and acceptance

Full test:all passed: 168 production + 12 design + 15 shell + 85 prototype = 280.
The final focused attachment browser rerun passed 8 desktop/mobile checks.
All 16 rollback-only SQL suites passed, including the updated service-only RPC contract.
Local workflow integration: 3 passed; private Storage/safety: 5 passed.
Byte-validation and request-schema units: 5 + 5 passed.
TypeScript, lint, formatting, production builds and whitespace checks passed.
Secret scan checked 40 client artifacts and 2 test logs with no configured-secret matches.
Final attachment rows, events, rate windows, private objects and generated Auth fixtures were zero.
Initial browser selectors were corrected to match the existing accessible FilePicker and DetailSection components.
The older authorization regression now explicitly expects the two new attachment RPCs to remain service-only.
Browser tests cover all four formats, duplicate filenames, downloads, removal, restricted access, lost responses, body limits and throttling.
Manual Windows integration and owner acceptance remain required after the final delivery batch.

## Limits

DEC-025 provides local structural validation, not antivirus scanning or malware certification.
Hard navigation/restart does not persist the selected File or mounted-panel retry state.
A crash/network failure can leave a hidden pending object needing reconciliation; no automatic reconciliation job is implemented.
An already issued bearer link can remain valid until expiry if object removal fails.
Standalone/serverless parser packaging and broader production deployment are not verified.
After all copy-paste batches, stop for Sprint 15 manual verification and explicit approval before Sprint 16.

## Copy-paste delivery order

1. Request boundary, migration, shared contract, local service, configuration and fixture cleanup.
2. Complete attachment UI and complete existing Lead Details replacement files.
3. Complete browser tests/configuration, final results and manual acceptance checklist.

These are delivery batches of one Sprint 15 implementation, not additional sprints.