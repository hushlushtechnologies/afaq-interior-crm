# Sprint 16 Part 1 — audit and validation contracts

Sprint 15 was accepted by the owner on 2026-11-10 (Asia/Dubai), including the
final room/site-visit attachment-reference balance. Sprint 16 is authorized;
Sprint 17 and Phase 4 are not started.

## Inspected implementation

- Existing layered checkout: /workspace/afaq-sprint14-remaining, with earlier
  accepted changes preserved. No reset, checkout, commit or push was performed.
- Existing lead permissions/scopes are in src/features/access/catalog.ts and
  crm_sales.allowed; they cover current lead reads/updates/assignment/archive.
  There is no installed separate activity/follow-up permission catalogue.
- Existing site visits, internal notes, stage/assignment history and private
  attachment references are implemented. They must be reused, not duplicated.
- The activity timeline is currently inline in the development Lead Details
  prototype. Its layout can be reused; its fictional records cannot become
  live business data.
- /leads/follow-ups exists in navigation but has no dedicated live follow-up
  service. No activity, follow-up, notification or reminder tables were found
  in the current migrations.
- The notification bell explicitly says no live notifications are connected.
- Phase 0 TABLE_DICTIONARY_SALES_SUPPORT.md sections 4.1–4.4 provide the
  conceptual activities/follow-ups model; current business context remains leads.
- Phase 0 role matrices are proposals. Actual installed grants take precedence;
  no new Sales Manager role or broader Management/PM write grants are assumed.
- DEC-009 remains open for reliable background work/scheduling. DEC-022 does
  not authorize a new external reminder provider. No browser timer will be used
  as the critical reminder mechanism.

## Owner decision

Follow-ups may be assigned only to the lead's current active Sales owner.
This was explicitly selected by the owner in chat on 2026-11-10. The database
must verify the current relationship and employee eligibility at mutation time.
A UUID passing schema validation is not proof of eligibility.
Historical assignments must remain traceable; owner changes must be reviewed
rather than silently rewriting completed records.

## This part

- Strict manual call/meeting/WhatsApp/email logging input, with actual timestamp,
  optional unknown outcome/notes, and no client-supplied actor/delivery claims.
- Follow-up create/update/reschedule/complete/cancel request contracts.
- Existing low/normal/high/urgent priority definitions are reused.
- Ordinary updates cannot change due_at; rescheduling requires its own reason.
- Completion requires meaningful outcome and nonfuture actual time; cancellation
  requires a reason. These input contracts do not enforce stored transitions.
- Open/completed/cancelled terminology follows the Phase 0 follow-up proposal.
- Dubai-time preview flags intentionally let today and overdue overlap. Exact
  due time is not yet overdue; finalized records leave open-task views.
- Database/server clocks must be authoritative when these views are connected.

## Remaining Sprint 16 sequence

1. Explain the additive migration, implement lead-scoped database operations,
   owner validation, RLS, audit/history, optimistic versions and retry receipts.
2. Connect manual activities and daily follow-up views, completion/rescheduling
   controls and the existing timeline layout. Reuse notes/visits/stage history.
3. Resolve the reliable scheduler decision and implement approved in-app
   reminder delivery with deduplication and revoked-access protection.
4. Run integrated SQL/browser/static/build checks and stop for manual acceptance.

## Verification and limitations

Eight unit tests passed. TypeScript, ESLint, project formatting and whitespace
checks passed; the new runner was formatted explicitly.
No migration, database fixture, Storage operation, email, WhatsApp message,
notification, scheduler, dependency installation or production change occurred.
SQL/RLS, browser submission, full regression and production-build tests were not
run for this validation-only part. Those remain required as functionality connects.
The contracts alone provide no authorization, persistence or idempotent execution.

Files: src/features/follow-ups/schemas.ts; tests/unit/follow-up-contracts.spec.ts;
playwright.follow-ups-unit.config.ts; this report; updated Sprint 15 closeout.
Copy complete files and run the supplied Windows commands. No visible UI change
is expected yet. Continue Sprint 16 only; do not start Sprint 17 without approval.