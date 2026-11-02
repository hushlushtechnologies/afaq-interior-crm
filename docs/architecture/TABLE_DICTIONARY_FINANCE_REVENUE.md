# Afaq Al Manzel Interiors CRM — Finance Revenue Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed physical design

## 1. Scope

Defines proposed records for:
- Budget categories and versioned project budgets.
- Project billing milestones.
- Customer invoices and issued content.
- Customer receipts and allocations.
- Allocation reversals.
- Invoice credits and void evidence.
- Customer refund records.

This is not a full general ledger.

Supplier bills, expenses, commitments and actual-cost reconciliation
will be defined separately.

No financial operation, migration or payment transfer is performed
by this document.

## 2. Conventions and unresolved policies

Use DATABASE_CONVENTIONS.md.

Common Mutable Columns and Archive Columns include their full
definitions from that document.

Default — means no database default.

Initial currency:
AED only.

Proposed physical precision:
- Currency amounts: numeric(18,2).
- Unit prices: numeric(18,6).
- Quantities: numeric(18,4).
- Decimal rates: numeric(9,6).

These types do not establish tax, quantity or rounding policy.

Open business policies:
- Tax treatment.
- Invoice numbering and required content.
- Discounts and rounding.
- Budget approval authority.
- Invoice issue and correction authority.
- Partial/excess payment handling.
- Credit/refund rules.
- Revenue and profitability definitions.
- Financial closure conditions.

The table structures support review of these workflows.
They do not authorize an operation whose policy remains unresolved.

## 3. Core financial distinctions

Quoted amount:
An amount proposed in a quotation version.

Accepted contract amount:
The approved accepted scope and authorized subsequent commercial changes.

Invoiced amount:
Amounts on eligible issued invoices, with separately recorded corrections.

Received amount:
Recorded customer receipts, with their approved corrections distinguished.

Allocated amount:
The part of an eligible receipt applied to an eligible invoice.

Outstanding receivable:
An approved calculation using invoices, credits, valid allocations
and applicable correction rules.

Budget:
A plan, not an invoice, payment or actual cost.

Do not use a single editable paid flag or project total to replace
these records.

## 4. Budget categories

### 4.1 budget_categories

Purpose:
Controlled project budget and cost classifications.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| name | text | NN | — |
| description | text | Nullable | — |
| sort_order | integer | NN | 0 |

Rules:
- Referenced category history survives archival.
- Category names do not determine accounting treatment.
- Changing a label must not silently reclassify historical financial reports.
- Detailed category configuration requires authorized Finance settings access.

## 5. Project budgets

### 5.1 project_budgets

Purpose:
Stable identity of a project's budget.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id, UQ | — |
| title | text | NN | — |

Rules:
- This proposal uses one budget identity per project with multiple versions.
- Alternative scenarios may be represented as draft versions if the
  approved business workflow permits.
- The effective approved version must be selected through a controlled
  operation, not whichever row has the latest timestamp.
- Archiving must not erase approved budget history.

### 5.2 project_budget_versions

Purpose:
Preserve a particular budget proposal or approved baseline.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_budget_id | uuid | NN, FK project_budgets.id | — |
| version_number | integer | NN | — |
| currency_code | text | NN | 'AED' |
| preparation_state | text | NN | 'draft' |
| assumptions | text | Nullable | — |
| total_budget_amount | numeric(18,2) | NN | 0 |
| submitted_at | timestamptz | Nullable | — |
| submitted_by | uuid | Nullable, FK employees.id | — |

Uniqueness:
(project_budget_id, version_number).

Proposed preparation states:
draft, submitted, withdrawn.

Rules:
- Positive version number.
- Submitted content and items are frozen.
- Revised budget content creates a new version.
- Total reconciles with budget items under approved calculation rules.
- Approval authority and baseline-replacement rules remain open.
- Submission is not approval.

### 5.3 project_budget_items

Purpose:
Category-level planned amounts within a budget version.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| budget_version_id | uuid | NN, FK project_budget_versions.id | — |
| line_number | integer | NN | — |
| category_id | uuid | NN, FK budget_categories.id | — |
| description | text | NN | — |
| planned_amount | numeric(18,2) | NN | — |
| notes | text | Nullable | — |

Uniqueness:
(budget_version_id, line_number).

Rules:
- Planned amounts follow the approved budget policy.
- This proposal does not use negative lines as an undocumented correction method.
- Frozen version items cannot be edited directly.
- Category totals are calculated from items.
- No spending authority is inferred from a budget line alone.

### 5.4 project_budget_decisions

Purpose:
Append-only decisions about exact budget versions.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| budget_version_id | uuid | NN, FK project_budget_versions.id | — |
| reviewer_employee_id | uuid | NN, FK employees.id | — |
| decision | text | NN | — |
| reason | text | Nullable | — |
| decided_at | timestamptz | NN | now() |
| idempotency_key | uuid | NN, UQ | — |

Proposed decisions:
approved, rejected, changes_requested.

Rules:
- Actual approver eligibility must come from an approved policy.
- PM financial viewing does not imply budget approval authority.
- A decision applies only to the frozen reviewed version.
- Concurrent/conflicting decisions need explicit effective-decision rules.
- Approval history is not overwritten.

## 6. Project billing schedule

### 6.1 project_billing_milestones

Purpose:
Track project billing obligations derived from accepted commercial scope.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| source_quotation_milestone_id | uuid | Nullable, FK quotation_payment_milestones.id | — |
| scope_change_id | uuid | Nullable, FK project_scope_changes.id | — |
| sequence_number | integer | NN | — |
| title | text | NN | — |
| billing_trigger_snapshot | text | NN | — |
| scheduled_amount | numeric(18,2) | NN | — |
| planned_due_date | date | Nullable | — |
| schedule_state | text | NN | 'planned' |

Uniqueness:
(project_id, sequence_number).

Proposed states:
planned, eligible_for_billing, cancelled_by_approved_change.

Rules:
- Quotation source must belong to the accepted commercial context.
- Scope-change source must belong to this project.
- A milestone may originate from accepted scope or an approved change.
- Later schedule changes require traceable authorized handling.
- Scheduled is not invoiced.
- Eligible for billing is not proof of receipt.
- Invoice allocations determine how much was billed.
- Final schedule reconciliation and commercial-change rules remain open.

## 7. Customer invoice identity

### 7.1 customer_invoices

Purpose:
Stable identity for one customer invoice.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| project_id | uuid | NN, FK projects.id | — |
| client_id | uuid | NN, FK clients.id | — |
| internal_reference | text | NN, UQ | — |

Rules:
- Client must agree with the project's customer relationship.
- Internal reference is distinct from the final issued invoice number.
- A draft does not create an issued receivable.
- Issued invoices are corrected through approved separate records,
  not silently rewritten.

## 8. Invoice content and issue

### 8.1 customer_invoice_versions

Purpose:
Draft content and the exact snapshot selected for invoice issue.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| invoice_id | uuid | NN, FK customer_invoices.id | — |
| version_number | integer | NN | — |
| currency_code | text | NN | 'AED' |
| preparation_state | text | NN | 'draft' |
| customer_name_snapshot | text | NN | — |
| customer_address_snapshot | text | Nullable | — |
| customer_tax_number_snapshot | text | Nullable | — |
| company_details_snapshot | jsonb | NN | — |
| terms_snapshot | text | Nullable | — |
| subtotal_amount | numeric(18,2) | NN | 0 |
| discount_amount | numeric(18,2) | NN | 0 |
| tax_amount | numeric(18,2) | NN | 0 |
| total_amount | numeric(18,2) | NN | 0 |
| calculation_policy_snapshot | jsonb | NN | — |
| frozen_at | timestamptz | Nullable | — |

Uniqueness:
(invoice_id, version_number).

Proposed preparation states:
draft, frozen, withdrawn.

Rules:
- Frozen/issued content cannot be changed directly.
- Snapshots preserve customer and company details used for the document.
- JSON has a validated bounded schema and contains no secrets.
- Exact formulas, tax and rounding require approved policy.
- New drafts do not alter an already issued invoice.
- One invoice identity cannot be issued repeatedly as separate receivables.

### 8.2 customer_invoice_items

Purpose:
Line-level content for an invoice version.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| invoice_version_id | uuid | NN, FK customer_invoice_versions.id | — |
| line_number | integer | NN | — |
| description | text | NN | — |
| quantity | numeric(18,4) | NN | — |
| unit_code | text | NN, FK units.code | — |
| unit_price | numeric(18,6) | NN | — |
| discount_amount | numeric(18,2) | NN | 0 |
| tax_rate | numeric(9,6) | Nullable | — |
| tax_amount | numeric(18,2) | NN | 0 |
| line_total_amount | numeric(18,2) | NN | — |

Uniqueness:
(invoice_version_id, line_number).

Rules:
- Use approved quantity, discount, tax and rounding rules.
- Do not hardcode a tax rate.
- Unit price precision does not imply posted amount precision.
- Frozen line content cannot be edited or deleted through ordinary updates.
- An invoice line does not create inventory movement.

### 8.3 invoice_milestone_allocations

Purpose:
Trace invoiced amounts to the project billing schedule.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| invoice_item_id | uuid | NN, FK customer_invoice_items.id | — |
| billing_milestone_id | uuid | NN, FK project_billing_milestones.id | — |
| allocated_amount | numeric(18,2) | NN | — |
| created_at | timestamptz | NN | now() |
| created_by | uuid | NN, FK employees.id | — |

Primary key:
(invoice_item_id, billing_milestone_id).

Rules:
- Positive allocated amount.
- Both records belong to the same project.
- Amount basis must be consistent: tax-exclusive versus tax-inclusive
  treatment requires explicit approved specification.
- Do not double bill a milestone through concurrent invoice issue.
- Draft allocation is not an issued charge.
- Issued allocations are frozen.
- Cancellation/credit treatment must reconcile billed schedule amounts.

### 8.4 customer_invoice_issues

Purpose:
Record the authoritative issuance of a particular invoice snapshot.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| invoice_id | uuid | NN, FK customer_invoices.id, UQ | — |
| invoice_version_id | uuid | NN, FK customer_invoice_versions.id, UQ | — |
| invoice_number | text | NN, UQ | — |
| invoice_date | date | NN | — |
| due_date | date | Nullable | — |
| issued_at | timestamptz | NN | now() |
| issued_by | uuid | NN, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Version must belong to invoice_id.
- Only an eligible frozen snapshot can be issued.
- Validate issue authority, policy, totals, numbering and schedule limits.
- No duplicate issue for the same invoice.
- Number allocation and issue must be concurrency safe.
- Issued content is immutable.
- External delivery success is separate from issuance.
- Payment status is derived, not an editable field here.
- Exact numbering and date policies remain open.

## 9. Customer receipts

### 9.1 customer_payments

Purpose:
Record customer money received, separately from invoice settlement.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| receipt_number | text | NN, UQ | — |
| client_id | uuid | NN, FK clients.id | — |
| intended_project_id | uuid | Nullable, FK projects.id | — |
| currency_code | text | NN | 'AED' |
| amount | numeric(18,2) | NN | — |
| received_date | date | NN | — |
| payment_method_code | text | NN | — |
| external_reference | text | Nullable | — |
| receipt_state | text | NN | 'draft' |
| posted_at | timestamptz | Nullable | — |
| posted_by | uuid | Nullable, FK employees.id | — |
| notes | text | Nullable | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
draft, posted, cancelled_before_posting.

Rules:
- Positive receipt amount.
- AED only initially.
- Intended project, if present, belongs to the client.
- Posting requires approved receipt evidence and authority.
- Posted receipt facts are immutable.
- Bank/reference duplicates require reviewed rules; references are not
  assumed globally unique.
- No bank account access, gateway collection or money transfer is implied.
- Allocation is a separate operation.
- Advances/unallocated funds need approved handling.

Access rule:
A receipt may settle more than one project for the same client only
if the approved allocation policy permits it.

A project PM must not receive the full shared receipt or unrelated project
allocations merely because one allocation relates to their project.

Expose only permitted project-specific financial projections.

### 9.2 customer_payment_evidence

Purpose:
Private evidence for a receipt.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| payment_id | uuid | NN, FK customer_payments.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Primary key:
(payment_id, file_asset_id).

Rules:
- Finance evidence is not automatically visible to every project member.
- Freeze required evidence with posting.
- Later evidence supplements require controlled audit.
- Avoid collecting unnecessary bank/customer information.

## 10. Receipt allocation

### 10.1 customer_payment_allocations

Purpose:
Apply part of a posted receipt to an eligible issued invoice.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| payment_id | uuid | NN, FK customer_payments.id | — |
| invoice_issue_id | uuid | NN, FK customer_invoice_issues.id | — |
| amount | numeric(18,2) | NN | — |
| allocated_at | timestamptz | NN | now() |
| allocated_by | uuid | NN, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Positive allocation amount.
- Payment is posted and eligible.
- Invoice is issued and eligible.
- Customer and currency agree.
- Enforce approved project-allocation restrictions.
- Available receipt and outstanding invoice limits are protected under concurrency.
- A valid allocation changes settlement interpretation, not original invoice value.
- Posted allocation records are append-only.
- Repeating a request cannot allocate the amount twice.

### 10.2 customer_payment_allocation_reversals

Purpose:
Traceably release a prior invoice allocation.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| allocation_id | uuid | NN, FK customer_payment_allocations.id | — |
| amount | numeric(18,2) | NN | — |
| reason | text | NN | — |
| reversed_at | timestamptz | NN | now() |
| reversed_by | uuid | NN, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Positive reversal amount.
- Total reversal cannot exceed the original effective allocation.
- Requires explicit correction authority.
- Original allocation remains.
- Reallocation requires a separately validated allocation.
- Releasing an allocation is not a refund or proof that money left the company.

## 11. Receipt corrections

### 11.1 customer_payment_reversals

Purpose:
Correct invalid recorded receipt amounts without pretending a refund occurred.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| payment_id | uuid | NN, FK customer_payments.id | — |
| amount | numeric(18,2) | NN | — |
| reason | text | NN | — |
| effective_date | date | NN | — |
| recorded_at | timestamptz | NN | now() |
| recorded_by | uuid | NN, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Positive correction amount.
- Total corrected amount cannot exceed the eligible original receipt.
- Reconcile active allocations and refunds before correction.
- An erroneous duplicate receipt differs from an actual cash refund.
- Preserve original receipt and correction evidence.
- Partial versus full reversal authority and permitted scenarios require policy.
- Do not implement this operation until that policy is approved.

## 12. Invoice credits

### 12.1 customer_credit_notes

Purpose:
Prepare and issue a traceable credit against an issued invoice.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| original_invoice_issue_id | uuid | NN, FK customer_invoice_issues.id | — |
| credit_note_number | text | Nullable, UQ | — |
| currency_code | text | NN | 'AED' |
| reason | text | NN | — |
| credit_state | text | NN | 'draft' |
| credit_date | date | Nullable | — |
| subtotal_amount | numeric(18,2) | NN | 0 |
| tax_amount | numeric(18,2) | NN | 0 |
| total_amount | numeric(18,2) | NN | 0 |
| calculation_policy_snapshot | jsonb | NN | — |
| issued_at | timestamptz | Nullable | — |
| issued_by | uuid | Nullable, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
draft, issued, cancelled_before_issue.

Rules:
- Issue requires approved correction/tax policy and explicit authority.
- Issued number, date, actor and content are required and immutable.
- Do not credit more than the eligible invoice basis under approved rules.
- Preserve the original invoice.
- Credit is not proof of a cash refund.
- Fully paid invoices and excess credit need explicit handling.
- Cross-invoice transferable customer credit is not silently assumed.
- Additional credit-application records may be required if that policy
  is selected; resolve before final schema approval.

### 12.2 customer_credit_note_items

Purpose:
Line-level credit evidence.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| credit_note_id | uuid | NN, FK customer_credit_notes.id | — |
| original_invoice_item_id | uuid | Nullable, FK customer_invoice_items.id | — |
| line_number | integer | NN | — |
| description | text | NN | — |
| credited_quantity | numeric(18,4) | Nullable | — |
| net_credit_amount | numeric(18,2) | NN | — |
| tax_rate | numeric(9,6) | Nullable | — |
| tax_credit_amount | numeric(18,2) | NN | 0 |
| total_credit_amount | numeric(18,2) | NN | — |

Uniqueness:
(credit_note_id, line_number).

Rules:
- Referenced invoice item belongs to the original issued invoice version.
- Credit amounts are represented as positive values with credit semantics.
- Original quantity/tax evidence must be preserved.
- Totals follow approved correction and rounding rules.
- Issued lines cannot be edited or deleted.

## 13. Invoice void evidence

### 13.1 customer_invoice_voids

Purpose:
Record a permitted invoice void without deleting the invoice.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| invoice_issue_id | uuid | NN, FK customer_invoice_issues.id, UQ | — |
| reason | text | NN | — |
| voided_at | timestamptz | NN | now() |
| voided_by | uuid | NN, FK employees.id | — |
| policy_reference | text | NN | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- This table does not establish that issued tax invoices may legally be voided.
- Permitted scenarios must be confirmed.
- Paid, credited or otherwise settled invoices need explicit restrictions.
- Invoice number and historical evidence remain preserved.
- Void must reconcile receivables and milestone billing effects.
- Reject the operation when policy is absent or prerequisites are unmet.
- If voiding issued invoices is not permitted, do not activate this operation.

## 14. Customer refunds

### 14.1 customer_refunds

Purpose:
Record an approved return of customer funds.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| refund_number | text | NN, UQ | — |
| client_id | uuid | NN, FK clients.id | — |
| related_credit_note_id | uuid | Nullable, FK customer_credit_notes.id | — |
| currency_code | text | NN | 'AED' |
| amount | numeric(18,2) | NN | — |
| reason | text | NN | — |
| refund_state | text | NN | 'draft' |
| refunded_date | date | Nullable | — |
| payment_method_code | text | Nullable | — |
| external_reference | text | Nullable | — |
| recorded_at | timestamptz | Nullable | — |
| recorded_by | uuid | Nullable, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
draft, recorded, cancelled_before_recording.

Rules:
- Positive amount.
- Requires explicit approved authority and sufficient evidence.
- A refund record does not initiate a bank transfer.
- Recorded means Finance documented a refund under the approved evidence policy.
- Related credit, if supplied, belongs to the same client.
- Refund reason may concern overpayment or another approved basis.
- Credit issuance alone is insufficient proof money was refunded.
- Approval workflow remains open; add exact-content decision records if
  the approved policy requires a separate approval stage.

### 14.2 customer_refund_sources

Purpose:
Identify which original receipts fund the recorded refund.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| refund_id | uuid | NN, FK customer_refunds.id | — |
| payment_id | uuid | NN, FK customer_payments.id | — |
| amount | numeric(18,2) | NN | — |
| created_at | timestamptz | NN | now() |
| created_by | uuid | NN, FK employees.id | — |

Primary key:
(refund_id, payment_id).

Rules:
- Positive amounts.
- Refund and receipts belong to the same client and currency.
- Source totals reconcile with the recorded refund amount.
- Funds cannot be allocated, reversed or refunded twice.
- Required prior deallocation follows approved policy.
- Posting locks relevant receipt/allocation/refund records consistently.
- Recorded source allocations are immutable.

## 15. Document files and delivery

The platform dictionary must provide explicit typed file relationships for:
- Frozen invoice PDFs.
- Issued credit documents.
- Refund evidence.
- Budget supporting documents.
- Delivery attempts.

Required behavior:
- Each generated document references the exact source snapshot.
- Regenerating a PDF cannot silently change issued commercial content.
- Download permission is independent of screen visibility.
- PMs see only authorized project-specific documents.
- Shared receipt evidence is not automatically disclosed to every linked project.
- External delivery failure does not undo valid invoice issuance.
- Private document storage and backups must meet the approved UAE policy.

No generic public file URL is authorized.

## 16. Calculated financial views

The application may expose controlled views/functions for:
- Issued invoice amount.
- Eligible credited amount.
- Effective receipt allocation.
- Unallocated receipt balance.
- Refund history.
- Outstanding receivables.
- Overdue invoices.
- Budget version comparisons.

Required:
- Define each metric and date basis.
- Distinguish invoice, credit, allocation, receipt and refund.
- Apply approved correction rules.
- Prevent cross-project disclosure.
- Preserve source traceability.

Do not finalize formulas while accounting/correction policy remains open.

No revenue-recognition policy is selected by displaying an invoice total.

## 17. Required constraints and concurrency controls

The later constraints and transaction documents must specify:

- Invoice/client/project consistency.
- Exact invoice version selection.
- Single issuance per invoice identity.
- Safe number generation.
- Frozen issued content and PDFs.
- Budget item/total reconciliation.
- Billing milestone allocation limits.
- Same-client/currency settlement.
- Receipt available-balance checks.
- Invoice outstanding-balance checks.
- Allocation reversal limits.
- Receipt reversal/refund interaction.
- Credit eligibility and limits.
- Void prerequisites.
- Idempotent issue/post/correct operations.
- Deterministic locking for concurrent allocations and refunds.
- Relevant foreign-key and query indexes.
- RLS and project-scoped financial projections.

A foreign key alone does not enforce these financial rules.

## 18. Financial access

Confirmed:
PMs may view financial information for assigned projects.

Not implied:
- Editing budgets.
- Issuing invoices.
- Posting receipts.
- Allocating payments.
- Issuing credits.
- Recording refunds.
- Approving financial corrections.
- Exporting financial data.
- Viewing other projects under the same customer.

Finance and Management access still requires the appropriate
approved action permissions and record scope.

Server responses and database access must enforce these distinctions.

## 19. Remaining schema and policy dependencies

Before finalizing Finance design:
- Confirm calculation/tax/rounding policy.
- Confirm budget authority.
- Confirm invoice numbering/content.
- Confirm permitted invoice void versus credit scenarios.
- Confirm overpayment/advance handling.
- Confirm cross-project receipt allocation.
- Confirm transferable customer-credit requirements.
- Confirm refund approval/evidence.
- Define supplier bills, expenses and actual costs.
- Define commitments and profitability.
- Define private evidence and audit relationships.
- Reconcile effective-date/reporting rules.
- Reconcile retention.

If an approved policy needs additional records, revise the design before
migrations rather than hiding the missing workflow in editable JSON.

## 20. Current status

Delivered:
Proposed budgets, billing, invoices, receipts, allocations and
customer correction/refund record structures.

Not completed:
Full Finance architecture or any financial implementation.

No tables have been created.
No migrations have run.
No calculations or permission tests have been executed.

Presence of a proposed table does not approve the business operation.