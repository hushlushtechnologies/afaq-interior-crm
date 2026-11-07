# Sprint 15 Part 4C — local attachment backend

Implemented the additive 20261107000400 migration, local server workflow and tests.
No UI, Server Action or Route Handler is exposed in this batch.

## Database and authorization

Attachment metadata and events use RLS and existing lead grants/scopes.
Employees cannot mutate metadata, finalize uploads or read private object paths.
Only the service-role gateway can reserve/finalize, and it revalidates the actor.
The application entry point obtains that actor from Supabase Auth getUser().
Upload requires leads.view and leads.update on an active, non-Lost lead.
Download requires current lead visibility; removal requires leads.archive.
Historical metadata and events survive removal; file bytes are removed separately.
No role grants, final-Super-Admin logic, bucket limits or bucket guards changed.

## Storage and retries

The Node-only workflow validates actual bytes before Storage insertion.
Paths use database-generated UUIDs; uploads never overwrite objects.
An unchanged actor/request ID reuses its metadata; changed content is rejected.
Pending/failed records are hidden. Finalization verifies stored size/MIME and
records the upload event atomically. Cleanup never deletes a committed retry.
Download links last 60 seconds and are audited before being returned.
Removal first hides the attachment, then deletes its object; retries clean up.
New reservations are limited to 10 per minute per actor; this does not limit
all parsing attempts, downloads, or traffic across all application instances.

## Verification

Local backup and transaction-only migration preflight completed before application.
Three actual local Storage workflow tests and five private Storage/safety tests pass.
Twelve desktop/mobile site-visit regression tests pass with the shared cleanup helper.
Attachment SQL and existing private Storage SQL tests pass with rollback.
TypeScript, ESLint, formatting, production build and whitespace checks pass.
Attachment fixture rows, events and private objects were zero after cleanup.
Configured secret bindings were absent from 41 production client artifacts.
Browser submission, action/body limits and attachment UI are pending integration.

## Limitations and checkpoint

DEC-025 remains local validation only, without malware scanning.
The application entry point stays disabled unless explicitly enabled for the
dedicated local project. Never configure this local administrative key for production.
A crash/network outage can leave an invisible pending object needing reconciliation;
automatic background reconciliation is not implemented in this batch.
Previously issued bearer links may remain valid until expiry if object cleanup fails.
Child-process packaging for standalone/serverless deployment is not verified.
Continue with the protected attachment UI and final Sprint 15 verification only.
Do not start Sprint 16 without owner acceptance.