# Sprint 15 — Approved site-visit workflow

Status: approved by the project owner in chat on 2026-11-07 (Asia/Dubai).
This is the business policy for the subsequent site-visit implementation, not a claim that it is already delivered.

## Status and assignment

- Statuses: Planned, Completed and Cancelled. Default: Planned.
- Planned may transition to Completed or Cancelled. Completed and Cancelled are terminal; reopening, Completed-to-Cancelled changes and corrections to finalized visits require a separately approved administrative workflow.
- A visit may be unassigned. New/revised assignment must use the lead's current active Sales owner. Arbitrary employee assignment is forbidden.
- Preserve historical assignments when the lead owner changes. Flag upcoming planned visits assigned to a previous owner for review/reassignment. Never automatically change completed/cancelled visits.

## Authorization and validation

- Creation/editing requires existing lead-update permission and current authorized lead access, enforced server-side and through RLS. Do not introduce a separate permission system.
- Planned visits require a scheduled date/time. Store timestamps consistently and display in Asia/Dubai.
- Completion requires actual visit date/time, a meaningful nonempty outcome and current permission. Actual completion cannot be in the future.
- Cancellation requires a reason; record the cancelling actor and timestamp.
- Reject invalid dates/inconsistent timestamps. Preserve created-by and updated-by identities.

## UI and history

Reuse the existing design system. Provide creation/editing, scheduled date/time, assignee, status badges, outcome, notes, completion/cancellation actions and history within Lead Details.

Audit visit creation, assignment/schedule/status changes, completion and cancellation. Test every allowed/blocked transition, assignment restriction, required field, authorization boundary and history preservation.

No calendar integration, GPS, route optimization or automated customer notification is authorized. Continue Sprint 15 only and stop for testing/approval before Sprint 16.