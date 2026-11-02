# Afaq Al Manzel Interiors CRM — Database Conventions

Document version: 0.2
Phase: 0
Sprint: 02
Status: Proposed physical-design conventions

## 1. Purpose

Define consistent physical schema and provenance conventions.

This document is not executable SQL.
No database objects have been created.

Version 0.2 adds operation execution provenance to Common Mutable Columns.

Every previous dictionary declaration of Common Mutable Columns includes
the complete updated definition below.

## 2. Naming and notation

- Tables: plural snake_case.
- Columns: snake_case.
- Primary identifiers: id.
- References: descriptive_name_id.
- Instants: descriptive_name_at.
- Calendar dates: descriptive_name_date where appropriate.

| Notation | Meaning |
| --- | --- |
| PK | Primary key |
| FK | Foreign key |
| UQ | Unique constraint |
| NN | NOT NULL |
| Nullable | NULL permitted |
| Default — | No database default |
| uuid | UUID identifier |
| timestamptz | Timestamp representing an instant |
| date | Calendar date |
| numeric(p,s) | Exact decimal |
| jsonb | Validated structured JSON |
| text | Text with appropriate validation |

Internal IDs and human-readable business numbers are distinct.

## 3. Common Mutable Columns

A table declaring Common Mutable Columns includes all columns below.

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| created_at | timestamptz | NN | now() |
| created_by | uuid | NN, FK employees.id | — |
| created_execution_id | uuid | NN, FK operation_executions.id | — |
| updated_at | timestamptz | NN | now() |
| updated_by | uuid | NN, FK employees.id | — |
| updated_execution_id | uuid | NN, FK operation_executions.id | — |

Meaning:
- created_by and updated_by identify the accountable employee.
- Execution references identify the actual executing employee or service.
- A direct human operation normally has the same employee as accountable
  employee and executor.
- An automated operation must have an explicit eligible delegation.
- Its accountable employee must be a real authorized employee.
- The actual service executor remains visible through operation_executions.

Rules:
- Actor/execution fields are server-controlled.
- Accountable employee must agree with the execution.
- Do not fabricate an employee to represent a machine.
- Do not pretend the employee personally clicked an automated action.
- Display automated provenance accurately.
- Deactivated or unauthorized sponsors cannot continue granting authority.
- An integration without valid authority may stage an event, but cannot
  create business records through these columns.
- updated_at requires a maintained update mechanism; its default alone
  does not update it later.

## 4. Explicit employee decision fields

Fields such as reviewer_employee_id and employee_reviewer_id identify
the actual human decision-maker.

Automation must not impersonate:
- A PM quotation decision.
- A client decision.
- A purchase approver.
- Another required human approval.

Other explicit employee actor fields must be reconciled with operation
execution and audit evidence before final schema approval.

Do not assume that every employee reference permits delegation.

## 5. Archive Columns

A table declaring Archive Columns includes:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| archived_at | timestamptz | Nullable | — |
| archived_by | uuid | Nullable, FK employees.id | — |
| archive_reason | text | Nullable | — |

Rules:
- Archive actor/time agree.
- Archiving requires permission and execution/audit evidence.
- Relationships and history remain intact.
- Archival is not hard deletion.
- Retention/deletion policy remains separately required.

## 6. Bootstrap

The initial administrator requires a narrowly controlled setup operation.

employees does not use Common Mutable Columns.

Bootstrap order can establish:
1. The verified initial employee.
2. A direct human operation execution.
3. Reviewed roles and permissions.
4. Subsequent ordinary configuration.

Do not add a permanent bypass, fake user or unrestricted public function
to solve bootstrap.

Detailed bootstrap authorization belongs to the security specification.

## 7. References and deletion

Use restrictive deletion for durable business relationships.

Do not cascade-delete commercial, approval, financial, stock or audit history.

Exceptions require explicit justification.

A foreign key proves existence, not access.

Use composite constraints or controlled functions for consistency across
project, client, version, room and material relationships.

Exact mechanisms are specified in the constraints/transaction documents.

## 8. Time

Store instants as timestamptz.
Use date for calendar dates.

Initial business timezone:
Asia/Dubai.

Do not use formatted strings as authoritative dates.
Do not confuse business effective time with recording/posting time.

## 9. Money

Initial currency:
AED.

Proposed physical types:
- Posted amounts: numeric(18,2).
- Unit prices: numeric(18,6).
- Rates: numeric(9,6).

Final precision, rounding, tax and correction policies require approval.

Never use binary floating point for authoritative monetary arithmetic.

Historical documents retain calculation-policy snapshots.

Provider billing currency may differ from CRM financial currency.
Any AI budget conversion needs an approved documented basis; it does
not introduce general multi-currency project accounting.

## 10. Quantity and units

Proposed quantity type:
numeric(18,4).

No automatic conversion initially.

Validate unit compatibility and fractional-quantity rules.
Material quantities must retain their unit meaning.

Final precision, unit catalogue and valuation remain open.

## 11. Statuses

Configurable display stages do not replace protected business outcomes.

Won/Lost, approvals, releases, issue and posting operations require
guarded state transitions.

Proposed dictionary labels are not approved business policies by themselves.

## 12. Snapshots and JSON

Use typed relationships for business facts.

Use bounded validated jsonb for appropriate:
- Policy snapshots.
- Safe provider metadata.
- Validated settings.
- Defined before/after change evidence.

Do not store:
- Credentials.
- OTPs.
- Raw bearer tokens.
- Arbitrary unvalidated references.
- Unnecessary copies of sensitive records.

## 13. Immutable content

Freeze submitted/issued content and relevant file manifests.

Separate:
- Preparation.
- Decisions.
- Posting/issue.
- Delivery.
- Correction/supersession.

Enforce immutability at the server/database/storage boundaries.

A disabled UI control is insufficient.

## 14. Private files

Object storage is private.

New bytes require a new immutable object identity.
Do not overwrite a file behind an approved document reference.

Business link records determine access.
Uploader identity alone does not grant access to every downstream context.

Short-lived authorized delivery is not permission to publish a file.

## 15. Execution, audit and secrets

operation_executions identifies the actual executor and accountable authority.

Audit evidence identifies critical actions and targets.

Job logs and ordinary errors must not contain secrets or private payload dumps.

Provider credentials remain outside ordinary database settings.

## 16. Audit target references

Business records should use enforceable typed foreign keys.

Audit records are a justified exception:
they may retain a controlled entity_type and entity_id because history
must remain meaningful after an approved target deletion.

Restrictions:
- Entity types are allowlisted.
- Targets are supplied by trusted operations.
- Audit references do not grant access to target records.
- Audit content is bounded and redacted.
- This exception does not authorize generic unvalidated business links.

## 17. Validation layers

Client:
Usability validation.

Server:
Identity, authority, shape, value and operation validation.

Database:
Constraints, transactions, relevant RLS and concurrent integrity.

Defaults do not provide authorization.

## 18. Review state

Physical definitions remain proposed.

Before migrations:
- Complete all dictionary domains.
- Reconcile execution provenance.
- Resolve material policy/schema dependencies.
- Define constraints and indexes.
- Define RLS and restricted operations.
- Review bootstrap.
- Review UAE provider compatibility.
- Complete Sprint 02 validation and approval.

No implementation or test results are claimed.