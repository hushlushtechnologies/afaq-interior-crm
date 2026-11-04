# Sprint 11 — Employee management closeout

## Status

Employee invitation and account-management implementation is complete for the isolated local environment. Final owner acceptance remains pending for Parts 5 and 6; this report does not approve that checkpoint.

| Part | Implemented behavior | Acceptance evidence |
| --- | --- | --- |
| 1 | Strict employee-name/email validation, normalized email, no client-selected roles | Unit and browser checks |
| 2 | Session-authorized invitation recording, immutable retry receipts, duplicate and existing-account handling | SQL and browser checks |
| 3 | Protected invitation form with stable retry IDs and truthful queued/pending/account messages | Owner reported manual checks passed; browser regressions |
| 4 | Local Auth invitation delivery, local email viewer, verified initial-password acceptance, no automatic roles | Owner reported manual checks passed; browser regressions |
| 5 | Protected directory, search/pagination, optimistic activation/deactivation, immutable status-change receipts | SQL/browser checks; owner manual confirmation pending |
| 6 | Reviewed replacement links, recovery after email verification, identity preservation, protected lifecycle history and recovery receipts | SQL/browser checks; owner manual confirmation pending |

## Migration explanation

`20261104000300_sprint11_invitation_recovery.sql` follows the invitation-request, local-delivery, and employee-status migrations. It adds private `invitation_recovery_requests` and `invitation_events` tables, an invitation lifecycle trigger, a Super Admin lookup RPC, and a reviewed replacement-claim RPC. It extends the existing service-only reconciliation RPC to recognize an already bound Auth identity during replacement. It does not assign roles, delete employees, or change SMTP settings. Historical events are not invented or backfilled; lifecycle recording starts at installation.

Direct table access remains revoked, including service-role table writes. Human workflows require the current authenticated Super Admin and the company role-management permission. Recovery uses the same advisory lock as access-management changes. Auth-provider operations are server-only and gated by the exact local project/API configuration and explicit local-delivery flag. Recipients must end in `@example.test`.

A new reviewed replacement requires a fresh UUID and a 60-second cooldown. An unchanged retry UUID checks its existing attempt and never starts another send. Uncertain responses are not proof of failure: review the local viewer before authorizing another replacement. A bound invitation is never reassigned if its Auth email changes concurrently. The client retains that UUID across retries and dialog cancellation; keep the page open while checking an uncertain result. A refreshed page can find the invitation by email and show its current status and latest 20 lifecycle events.

Unconfirmed invitees receive a replacement invite using the same Auth identity. A recipient who verified the original email but did not finish acceptance receives an Auth recovery link. Both fragment token types are accepted only for a verified, linked employee invitation; acceptance grants no roles. Accepted invitations do not send again. Unrelated identities are rejected for review. Account status, existing role assignments, historical Auth identity, and final-Super-Admin protections remain intact.

Audit events record request, delivery attempt, confirmation/uncertainty, acceptance, and explicit reviewed replacement authorization. Human authorization has the session actor; service reconciliation is labelled System. Tokens and passwords are never written into lifecycle events.

## Regression repairs

The full application verification exposed older tests that treated streamed Next.js not-found pages as necessarily HTTP 404. Those tests now allow documented HTTP 200/404 streaming behavior while requiring the not-found UI and noindex metadata. Development-only content remains asserted absent.

Auth error locators are scoped to their forms instead of matching Next's route announcer. Shell tests establish hydration through an actual interaction before hover/window keyboard checks and specify heading level. Shell dialog animations now run only under `prefers-reduced-motion: no-preference`. Navigation search uses its natural text label at every viewport, retaining its keyboard shortcut metadata. Prototype fixtures now target actual input controls and application alerts, wait for an observable interaction before local state changes, and locate a paginated lead before checking its stage. The Kanban scroller contains absolute screen-reader labels, preventing document overflow; attachment information labels include their visible button text.

## Verification

Verified on 2026-11-04 against the isolated local project:

- Full `npm run test:all`: **208 passed** (96 production, 12 design, 15 workspace shell, 85 prototype). Exit code 0.
- Employee validation/request unit suite: **11 passed**. Exit code 0.
- All four SQL suites passed with transaction rollback: invitation requests, employee status, final Super Admin, invitation recovery.
- Lint, route generation/TypeScript, formatting, and `git diff --check` passed. Production builds passed as part of the full browser suite.
- New recovery browser coverage includes old-token invalidation, unchanged Auth identity and zero automatic roles, verified-but-unaccepted recovery completion, lost-response replay with one replacement receipt/email, explicit review/cooldown, revoked authority, and history after refresh on desktop and mobile.
- Recovery SQL also covers cross-actor receipt denial, accepted-invitation no-op, unrelated-identity rejection, a concurrent Auth email change without rebinding the invitation, and revoked/direct/anonymous privileges.
- Final local counts for employees, invitations, invitation receipts, status events, invitation events, and recovery receipts were all zero after cleanup. Existing access/authentication setup accounts were retained.
- The copy/paste cleanup helper was checked against temporary copies of all three earlier fixture files and rerun to verify idempotence. It edits local source only.

No real invitations were sent and no production data/settings were changed.

## Windows commands

From the repository root in PowerShell, with Docker Desktop and the existing isolated local Supabase project available:

```powershell
node .\scripts\prepare-sprint11-local-tests.mjs
npx.cmd prettier --write "tests/e2e/employee*.spec.ts"
npx.cmd supabase start
npx.cmd supabase migration up --local
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run format:check
npx.cmd playwright install chromium
npx.cmd playwright test --config playwright.employee.config.ts
Get-Content -Raw .\tests\sql\employee-invitations.sql | docker exec -i supabase_db_afaq-interiors-crm-s09-local psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
Get-Content -Raw .\tests\sql\employee-status.sql | docker exec -i supabase_db_afaq-interiors-crm-s09-local psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
Get-Content -Raw .\tests\sql\last-super-admin.sql | docker exec -i supabase_db_afaq-interiors-crm-s09-local psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
Get-Content -Raw .\tests\sql\employee-invitation-recovery.sql | docker exec -i supabase_db_afaq-interiors-crm-s09-local psql -U postgres -d postgres -X -v ON_ERROR_STOP=1
npm.cmd run test:all
```

The existing `.env.local` must retain its local publishable key, local server/test secret binding, confirmed E2E fixture credentials, and local `APP_URL`. Explicitly set `ENABLE_LOCAL_EMPLOYEE_INVITES=true` only there for this local workflow. `.env.example` defaults this flag to false. Do not copy actual credentials into the report, chat, or source control. SQL checks roll back all fixture changes. Browser fixtures create generated local accounts and clean their employee, receipt, audit, and Auth rows.

## Manual acceptance checkpoint

Start `npm.cmd run dev`, open the local app and http://127.0.0.1:57424, and sign in with your existing local Super Admin. Use generated `@example.test` recipients only.

1. Record an invitation and verify recording alone sends nothing. Deliver it and inspect the local viewer. Rechecking does not add another email.
2. After at least one minute, request a replacement. Cancelling restores focus. An unchecked review box cannot authorize replacement. Confirm after reviewing the viewer; the new link works and the old one is rejected.
3. Separately verify a recipient's email, leave before setting their initial password, then request a reviewed replacement after the cooldown. The recovery link must allow completion, keep the same Auth identity, and assign no roles.
4. Refresh the admin page, expand Invitation recovery and history, find the recipient by email, and verify current status and readable lifecycle events with actor and Dubai timestamps. Find again after mutations to refresh the history. Pre-migration events are not shown.
5. With separate local accounts, check directory access: Super Admin can manage; Management can read only; Sales cannot read. Pending invitees have no account-activation controls.
6. Deactivate a non-final local employee, verify an existing browser session loses protected access, reactivate, and verify assigned roles/history remain intact. Confirm final eligible Super Admin deactivation remains rejected.
7. Repeat the invitation/recovery/directory controls at a narrow mobile width and with keyboard navigation.

Stop here for owner acceptance. Production email delivery, hosted SMTP/deployment, and Sprint 12 security/storage work remain separate workstreams.
