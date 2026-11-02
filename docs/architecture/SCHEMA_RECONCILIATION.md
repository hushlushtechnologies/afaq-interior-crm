# Afaq Al Manzel Interiors CRM — Schema Reconciliation

Document version: 0.1
Phase: 0
Sprint: 02
Status: Reconciliation in progress

## 1. Purpose

Check the proposed dictionaries against each other and identify missing
relationships, records and policy dependencies.

Review basis:
The document contents supplied in this conversation.

Local files:
The user has reported saving earlier parts.
The assistant has not inspected the user's local saved copies.

No automated schema or document validation has been performed.

## 2. Authority

Confirmed decisions remain recorded in ARCHITECTURE_DECISIONS.md.

Supporting table definitions appear in:
TABLE_DICTIONARY_SUPPORTING_RECORDS.md.

A reconciliation finding is not an executed schema change.

Before Sprint 02 approval:
- Resolve architecture-blocking choices.
- Supply complete replacements for affected existing documents.
- Consolidate constraints and transaction rules.
- Validate references across the final dictionary.
- Record remaining limitations honestly.

Do not generate migrations from these documents yet.

## 3. Findings

| ID | Finding | Required action | Current state |
| --- | --- | --- | --- |
| REC-001 | Human-readable numbers exist without a defined allocator. | Specify numbering policy/sequence records and concurrency-safe allocation. | Supporting records supplied; business formats open |
| REC-002 | Lead/opportunity ownership and stage history need explicit records. | Add typed assignment/stage/outcome events. | Supporting records supplied |
| REC-003 | PM ownership can change after conversion without a dedicated history record. | Add project manager assignment events and a guarded reassignment operation. | Supporting records supplied |
| REC-004 | Order cancellation/amendment behavior is incomplete. | Define cancellation records and distinguish them from order-version amendments. | Cancellation records supplied; amendment policy open |
| REC-005 | A stock transaction kind does not constitute a complete returns workflow. | Add return preparation, review and posting relationships. | Supporting records supplied; authority/policy open |
| REC-006 | Inventory count/adjustment/return evidence needs typed file links. | Add inventory evidence links. | Supporting records supplied |
| REC-007 | Generated invoice/credit/order documents need source/template/integrity metadata. | Add document manifests while retaining the dedicated quotation document path. | Supporting records supplied |
| REC-008 | Common Mutable Columns now include execution references. | Apply conventions version 0.2 consistently and reconcile explicit actor fields. | Convention supplied; final audit pending |
| REC-009 | Area-unit fields in requirements are text without explicit catalogue references. | Replace with units.code references and enforce appropriate area-unit semantics. | Full dictionary replacement pending |
| REC-010 | Cross-record consistency cannot rely on individual UUID foreign keys alone. | Specify composite constraints or guarded operations for project/client/version/room relationships. | Constraints delivery pending |
| REC-011 | Client verification mechanism is not selected. | Resolve method and define token/session lifecycle and access policy. | User clarification pending |
| REC-012 | Actual-cost recognition and warehouse valuation remain open. | Resolve policy and add enforceable inventory-cost source records where needed. | User clarification pending |
| REC-013 | Current AI usage entries do not yet define exact estimate-to-confirmed replacement relationships. | Specify reconciled cost evidence so estimates and final charges are not added twice. | Required before final AI schema approval |
| REC-014 | Notification contexts need complete event/template coverage. | Map required events to typed contexts and safe navigation. | Platform reconciliation pending |
| REC-015 | Configurable custom fields have no approved launch scope. | Confirm scope or explicitly defer; do not hide arbitrary fields in settings JSON. | Open requirement decision |
| REC-016 | Financial correction, approval and supplier settlement policies are incomplete. | Resolve which need additional records before final schema approval. | Open |
| REC-017 | Review and approval records need unambiguous effective-decision rules. | Specify conflicts, supersession, revocation and multiple-reviewer handling. | Open technical/business boundary |
| REC-018 | UAE compatibility of the proposed providers is unverified. | Verify database, files, backups and approved processing arrangements. | External feasibility verification outstanding |

## 4. Execution provenance

Common Mutable Columns version 0.2 provides:
- Accountable employee.
- Actual execution reference.
- Actual human or service executor.

This does not automatically fix every explicit actor field.

Final reconciliation must classify fields as:
1. Actual human reviewer/approver.
2. Accountable employee for an authorized delegated operation.
3. Actual execution identity through operation_executions.

Examples:
- PM approval reviewer must remain the actual human PM.
- A worker cannot create a client approval by selecting an employee.
- Scheduled reservation release needs truthful service execution evidence.
- Webhook staging does not imply authority to create a lead.

Any required dictionary replacements must be delivered before approval.

## 5. Snapshot and immutability consistency

Apply consistent rules across:
- Quotation versions.
- Purchase request/order versions.
- Design revisions and file manifests.
- Invoice versions and issue.
- Supplier bill versions/posting.
- Submitted expense content.
- Report versions.
- Posted stock transactions.

Required:
- Define when content freezes.
- Define allowed metadata updates separately.
- Freeze relevant child records and object identities.
- Serialize decisions against content/state changes.
- Preserve superseded content.
- Require traceable corrections.

Do not treat a UI status label as enforcement.

## 6. Proposed operational boundaries

### Numbering

Use a controlled sequence allocator.
Do not use record counts or MAX(number) + 1.

Number format, reset policy and legal requirements remain open.

### Purchase order changes

Commercial amendment:
Creates revised approved content and records its effect on existing obligations.

Cancellation:
Explicitly reduces an eligible outstanding obligation.

Neither operation deletes earlier receiving or billing history.

### Stock returns

Supplier return:
Physical stock leaves company custody with source evidence.

Unused issue return:
Previously issued unused material re-enters a tracked location.

Site-to-warehouse relocation:
Use the existing transfer workflow when stock remains tracked throughout.

Do not represent all three as unrelated positive adjustments.

### Generated documents

Preserve:
- Exact business source.
- Source content digest.
- Template version.
- Immutable output file.
- Generation execution.

Document generation does not grant sending or download permission.

## 7. Decisions currently being clarified

### Client review verification

Question:
May WhatsApp carry the invitation while email OTP verifies the reviewer?

Status:
Pending user response.

This is not an approved authentication mechanism yet.

### Direct project actual costs

Question:
Should eligible posted supplier bills/expenses establish actual project cost,
or should actual costs follow recorded cash payments?

Status:
Pending user response.

If cash-based reporting is selected:
Supplier payment/allocation records and additional reconciliation are needed.

### Warehouse valuation

Question:
Should Finance approve moving weighted average, FIFO or another method?

Status:
Pending user response.

A suggestion subject to Finance approval is not final financial policy.

## 8. Other decisions that remain visible

Do not infer answers for:
- Procurement thresholds.
- Tax/rounding.
- Refund/credit/void authority.
- Retention.
- Approval revocation/delegation.
- Multiple client representatives.
- Scope variations.
- Closure/reopening.
- Supplier settlement scope.
- Custom fields.
- Quantitative recovery and performance targets.

Some may be deferred until later implementation.
Any decision affecting physical relationships or security boundaries
must be resolved or explicitly bounded before final architecture approval.

## 9. Next technical deliverables

After relevant reconciliation:
1. Final table/relationship coverage.
2. Constraints and index specification.
3. Transaction boundaries.
4. Authorization and RLS.
5. Storage and client access.
6. Background execution and integration behavior.
7. Backup/recovery.
8. Validation checklist and Sprint 02 report.

These are authorized Sprint 02 design work, not completed work.

## 10. Current status

Major domains:
Drafted.

Supporting records:
Supplied in the companion dictionary.

Physical schema:
Not finalized.

Migrations:
Not created or applied.

Software/database tests:
Not executed.

Sprint 02:
In progress.