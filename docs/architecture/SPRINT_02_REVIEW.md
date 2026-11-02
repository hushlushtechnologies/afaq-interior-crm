# Afaq Al Manzel Interiors CRM — Sprint 02 Review

Phase: 0
Sprint: 02
Status: Awaiting approval of revised scope

## 1. Purpose

Record the architecture prepared so far and define the boundaries for
starting local application development.

The original Sprint 02 required a complete physical database specification.

That original scope has not been fully delivered.

Proposed revision:
Approve the current architecture as a local-development foundation.
Complete outstanding database and production specifications before their
affected migrations, features or environments are implemented.

No approved feature is removed.

## 2. Confirmed business decisions

- One company: Afaq Al Manzel Interiors.
- Approximately 20 employees and 3 active projects.
- Proposed stack: Next.js, React, TypeScript, Supabase and Vercel.
- Provider selection remains conditional on verified requirements.
- AED only.
- No automatic unit conversions initially.
- PMs may view financial information for assigned projects.
- PMs may approve quotations they prepared.
- Won requires an eligible PM and the same quotation version to have
  PM approval and client acceptance.
- Successful Won creates exactly one project immediately.
- Payment and completed handover are not prerequisites.
- Client design invitations are sent manually through WhatsApp.
- Email OTP verifies the client before a design decision.
- Eligible direct costs are recognized when Finance posts the bill or expense.
- Warehouse valuation remains open for Finance.
- Core customer records, private files and backups require verified UAE storage.
- External processing requires explicit approval.

## 3. Architecture prepared

Draft specifications cover:
- Employees, roles and permissions.
- Customers, leads and opportunities.
- Requirements, activities, follow-ups and imports.
- Quotation versions and approvals.
- Projects, tasks, dependencies and handover.
- Design revisions, review and release.
- Site reports, inspections and material requests.
- Procurement, receiving and inventory.
- Customer billing and payments.
- Supplier bills, expenses and commitments.
- AI generation, usage and sharing.
- Private files, execution provenance, jobs, audit and notifications.
- Client verification.
- Supporting numbering and history records.

These are proposed documents, not applied database objects.

## 4. Integrity requirements retained

### Relationships and uniqueness

- Enforce primary keys, required fields and declared uniqueness.
- Enforce one converted project per originating opportunity.
- Enforce version numbering within its parent record.
- Validate client, project, room, pipeline, stage and source relationships.
- Use composite relationships where appropriate.
- Do not assume separate UUID foreign keys prove cross-record consistency.

### Immutability

- Freeze submitted commercial and design content and relevant child records.
- Preserve issued documents and posted financial/stock records.
- Prevent replacement of approved file bytes behind an unchanged reference.
- Use controlled corrections and superseding records.

### Critical transactions

The following require explicit transactional specifications before implementation:
- Won conversion.
- Approval and release.
- Invoice/order issue and numbering.
- Receipt posting and allocation.
- Supplier bill/expense posting.
- Cost and commitment reconciliation.
- Goods receiving and stock effects.
- Reservation, transfer, return and adjustment.
- OTP consumption and session creation.
- AI budget admission.

Required:
Validate authority and current state, lock relevant records consistently,
prevent duplicate effects and commit required changes together.

Use database constraints where suitable.
Cross-row rules may require restricted functions or triggers; they cannot
all be expressed as ordinary CHECK constraints.

## 5. Index strategy retained

Before migrations, specify and review:
- Indexes supporting primary/unique constraints.
- Frequently queried relationship columns.
- Assigned-work and due-date queries.
- Project-scoped task/report/document queries.
- Version and decision lookup.
- Material/location ledger retrieval.
- Invoice/payment/allocation lookup.
- Eligible background job claim/retry queries.
- Scoped integration deduplication.
- Audit target/time queries.

PostgreSQL does not automatically create an index for every referencing
foreign-key column.

Avoid redundant indexes.
Validate important query plans against representative data when implemented.

## 6. Authorization requirements retained

- Resolve the active employee from verified authentication.
- Check action permission, record scope and business prerequisites.
- Apply appropriate RLS and restricted database operations.
- Do not rely on hidden buttons.
- Project membership alone does not grant all financial actions.
- PM finance access must not disclose other projects on shared sources.
- Service execution requires bounded authority and truthful provenance.
- Human-only decisions cannot be impersonated by workers.
- External review access is isolated from employee access.
- File access is checked independently.
- Revoked/expired authority blocks subsequent protected operations.

Any privileged database function requires reviewed execution grants,
safe object resolution and protection against caller-supplied actor spoofing.

Final policies/functions are not yet supplied or tested.

## 7. Storage, jobs and recovery requirements retained

Storage:
Private objects, validated uploads, immutable approved content and
authorized downloads.

Jobs:
Durable state, bounded retries, safe leases, idempotency and explicit
handling of uncertain external outcomes.

Audit:
Append-only critical evidence with redacted bounded content.

Recovery:
Define backup coverage, recovery targets, restoration tests and migration
rollback before production readiness.

No provider capability, region or restore result has been verified.

## 8. Outstanding work

Before affected database migrations:
- Final dictionary reconciliation.
- Complete physical constraints and indexes.
- Transaction functions and concurrency rules.
- RLS and privilege specification.
- Actor-field consistency.
- Effective approval/revocation rules.
- Client credential lifecycle.
- AI estimate/confirmed-charge reconciliation.
- Any required missing source records.

Before affected financial features:
- Tax, rounding and approval policies.
- Warehouse valuation and cost-source extension.
- Commercial variation and correction rules.
- Final profitability definitions.

Before connected environments or real customer data:
- UAE provider compatibility.
- Approved external processing.
- Credentials and secure configuration.
- Appropriate privacy controls.

Before production:
- Retention.
- Backup/restore and rollback verification.
- Security, performance and user acceptance testing.
- Resolution of critical defects.

Custom-field scope and other roadmap gaps remain tracked.

## 9. Proposed next sprint

Sprint 03 — Windows local development foundation:

1. Verify/install Node.js and Git.
2. Preserve the existing documentation folder.
3. Initialize Next.js with TypeScript.
4. Configure styling and development tooling.
5. Run the application locally.
6. Establish basic automated testing.
7. Verify lint, type checking, tests and production build.
8. Document actual outcomes.

Use synthetic data.

Do not apply unfinished business migrations.
Do not upload customer data.
Do not purchase or activate external integrations without authorization.
Do not implement later business-module sprints.

Connected Supabase setup remains subject to verified compatible configuration.

## 10. Evidence

User-reported:
Earlier documentation saved through Part 2H.

Not performed by the assistant:
Inspection of local Windows files, installation, migrations, application
execution, financial calculations or software tests.

No application functionality or production readiness is claimed.

## 11. Approval gate

Requested approval:
Accept this revised Sprint 02 scope and proceed to Sprint 03 local setup.

This approval acknowledges outstanding design work.
It does not declare the full production schema complete or waive its checks.

Sprint 03 starts only after explicit authorization.