# DEC-009 — approved local Sprint 16 reminder mechanism

Status: APPROVED by the owner in chat on 2026-11-11 for local Sprint 16 only.
The scheduler job is not enabled; implementation and verification are in progress.
This narrows only the local Sprint 16 reminder decision. It does not close the
broader AI/integration/background-work decision or approve production rollout.

Source: docs/requirements/OPEN_DECISIONS.md, DEC-009:
"Required approval: Project owner for architecture and service cost."
The Phase 3 plan also requires an approved reliable scheduler for reminders.

## Readiness checked

Dedicated local project: afaq-interiors-crm-s09-local. PostgreSQL reports pg_cron
1.6.4 available, pg_cron already preloaded, cron.database_name=postgres.
At initial inspection the extension was not installed. The approved Part 5A
migration now installs it locally; no cron job is scheduled.
No installed notification tables or live notification service were found;
the shell bell still explicitly reports that live notifications are absent.

## Approved local design

1. Use the existing local database's pg_cron extension, with one named job
   invoking a protected SQL worker once per minute. No browser scheduling,
   external provider, paid service, email, SMS or WhatsApp delivery.
2. Produce one employee in-app reminder when an open follow-up becomes due.
   Catch up overdue eligible tasks on the next run after database downtime.
   This is not an exact-time guarantee and requires the local database running.
3. Recipient must still be the task's assigned employee and the lead's current
   active eligible Sales owner, with current lead visibility. Skip stale owners,
   inactive/revoked users and Lost/archived leads. Reassignment remains explicit.
4. Deduplicate by follow-up, recipient and exact due timestamp. Repeated worker
   calls and ordinary task edits do not duplicate reminders. A different due
   timestamp or explicit new owner can create a new eligible reminder. Returning
   to an already-reminded owner/due combination does not produce another one.
5. Read/mark-read operations recheck current ownership, status and visibility.
   Hide obsolete reminders after rescheduling, reassignment, completion,
   cancellation, account deactivation or access revocation. Retain audit history.
6. Keep stored notification text generic; resolve customer/task details only
   after current authorization. Employees mark only their own visible notices read.
7. Use bounded transactional batches, serialization/locking and worker-run
   logging without customer text, secrets or signed URLs. Failed transactions
   retry on the next scheduled run without claiming exactly-once delivery.
8. Explain/preflight migrations before local application; provide full files,
   Windows commands and isolated SQL/browser/scheduler checks. Provide a safe
   local job disable command. No production migration, extension or cron job.

## Independent QA

A dedicated runner includes existing production browser cases plus all current
Sprint 16 UI suites, with no skipped required base files. SQL suites run first
and sequentially. These checks do not validate automatic reminders that are
not yet connected.