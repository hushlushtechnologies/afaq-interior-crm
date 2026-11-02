# Afaq Al Manzel Interiors CRM — Supporting Records Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed schema completion records

## 1. Scope and conventions

Defines additional records identified during reconciliation:
- Numbering.
- Sales/project ownership history.
- Purchase-order cancellation.
- Stock returns.
- Inventory evidence.
- Generated-document manifests.

Use DATABASE_CONVENTIONS.md version 0.2.

Common Mutable Columns include the complete updated convention.
Default — means no database default.

These additions do not resolve every remaining policy or schema gap.
No tables or migrations are created.

## 2. Numbering

### 2.1 numbering_policies

Purpose:
Define approved business-number formatting and reset behavior.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| document_kind | text | NN, UQ | — |
| prefix_template | text | NN | — |
| minimum_digits | integer | NN | — |
| reset_mode | text | NN | — |
| is_enabled | boolean | NN | true |

Proposed reset modes:
never, calendar_year.

Rules:
- Templates use a restricted validated token set.
- No executable expressions.
- Positive supported minimum_digits.
- Business formats and reset rules need approval.
- Changing a policy cannot renumber historical records.
- Tax/legal numbering requirements must be confirmed.
- Do not promise gapless numbering without a defined verified design.

### 2.2 numbering_sequences

Purpose:
Concurrency-safe counters for an approved policy and reset period.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| policy_id | uuid | NN, FK numbering_policies.id | — |
| period_key | text | NN | — |
| next_value | bigint | NN | 1 |
| updated_at | timestamptz | NN | now() |

Primary key:
(policy_id, period_key).

Rules:
- Positive next_value.
- period_key is derived server-side from policy.
- Controlled allocator locks/updates the sequence safely.
- Business number uniqueness is also enforced on the destination record.
- Failed operation/retry behavior must be defined.
- Do not reuse an issued number after archival or cancellation.
- No direct browser writes.

## 3. Sales history

### 3.1 sales_assignment_events

Purpose:
Preserve lead/opportunity ownership changes.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| lead_id | uuid | Nullable, FK leads.id | — |
| opportunity_id | uuid | Nullable, FK opportunities.id | — |
| previous_employee_id | uuid | Nullable, FK employees.id | — |
| new_employee_id | uuid | NN, FK employees.id | — |
| reason | text | Nullable | — |
| execution_id | uuid | NN, FK operation_executions.id | — |
| changed_at | timestamptz | NN | now() |

Rules:
- Exactly one lead/opportunity target.
- New owner must be eligible at assignment.
- Previous owner agrees with the locked current record.
- Owner update and history commit together.
- Historical inactive employees remain referenceable.
- Append only.

### 3.2 opportunity_stage_events

Purpose:
Preserve working-stage and pipeline transitions.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| opportunity_id | uuid | NN, FK opportunities.id | — |
| previous_pipeline_id | uuid | Nullable, FK sales_pipelines.id | — |
| previous_stage_id | uuid | Nullable, FK sales_pipeline_stages.id | — |
| new_pipeline_id | uuid | NN, FK sales_pipelines.id | — |
| new_stage_id | uuid | NN, FK sales_pipeline_stages.id | — |
| reason | text | Nullable | — |
| execution_id | uuid | NN, FK operation_executions.id | — |
| changed_at | timestamptz | NN | now() |

Rules:
- Each stage belongs to its stated pipeline.
- Previous pair is absent only for a legitimate initial event.
- Working-stage changes cannot perform Won conversion.
- Record and history update consistently.
- Pipeline reassignment requires explicit permitted behavior.
- Append only.

### 3.3 opportunity_outcome_events

Purpose:
Preserve protected outcome changes.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| opportunity_id | uuid | NN, FK opportunities.id | — |
| previous_outcome | text | NN | — |
| new_outcome | text | NN | — |
| lost_reason_id | uuid | Nullable, FK lost_reasons.id | — |
| resulting_project_id | uuid | Nullable, FK projects.id | — |
| reason | text | Nullable | — |
| execution_id | uuid | NN, FK operation_executions.id | — |
| changed_at | timestamptz | NN | now() |

Rules:
- Validate permitted transitions.
- Lost requires the configured valid reason.
- Won references the consistently created matching project.
- Reopening is not authorized merely because this table can store it.
- Outcome, conversion and project effects commit consistently.
- Append only.

## 4. Project ownership history

### 4.1 project_manager_assignment_events

Purpose:
Preserve PM ownership changes.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| project_id | uuid | NN, FK projects.id | — |
| previous_pm_id | uuid | Nullable, FK employees.id | — |
| new_pm_id | uuid | NN, FK employees.id | — |
| reason | text | Nullable | — |
| execution_id | uuid | NN, FK operation_executions.id | — |
| changed_at | timestamptz | NN | now() |

Rules:
- Initial conversion may have no previous PM.
- New PM is active and eligible at assignment.
- Project owner and required membership changes commit consistently.
- Do not rewrite historical approval reviewers.
- Reassignment authority remains explicitly permission-controlled.
- Append only.

## 5. Purchase-order cancellation

### 5.1 purchase_order_cancellations

Purpose:
Prepare a controlled reduction of an outstanding order obligation.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| order_issue_id | uuid | NN, FK purchase_order_issues.id | — |
| reason | text | NN | — |
| cancellation_state | text | NN | 'draft' |
| submitted_at | timestamptz | Nullable | — |
| applied_at | timestamptz | Nullable | — |
| applied_execution_id | uuid | Nullable, FK operation_executions.id | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
draft, submitted, approved, rejected, applied, withdrawn.

Rules:
- Submitted cancellation content is frozen.
- Approval policy and supplier confirmation requirements remain open.
- Applying cancellation reduces only eligible outstanding obligation.
- Do not erase historical receipts, bills or stock.
- Commitment changes reconcile with applied cancellation.
- A changed cancellation request requires controlled replacement/review.
- Authority to cancel is distinct from ordinary order editing.

### 5.2 purchase_order_cancellation_items

Purpose:
Identify the exact ordered portions proposed for cancellation.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| cancellation_id | uuid | NN, FK purchase_order_cancellations.id | — |
| order_item_id | uuid | NN, FK purchase_order_items.id | — |
| quantity | numeric(18,4) | NN | — |
| commitment_basis_amount | numeric(18,2) | NN | — |

Uniqueness:
(cancellation_id, order_item_id).

Rules:
- Positive quantity and valid corresponding amount basis.
- Item belongs to the referenced order issue.
- Validate remaining eligible quantity under concurrency.
- Received/billed/returned portions require their own approved treatment.
- Amount must follow the approved order basis and cancellation policy.
- No automatic supplier credit or refund is created.

### 5.3 purchase_order_cancellation_decisions

Purpose:
Append-only decisions against frozen cancellation content.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| cancellation_id | uuid | NN, FK purchase_order_cancellations.id | — |
| reviewer_employee_id | uuid | NN, FK employees.id | — |
| decision | text | NN | — |
| reason | text | Nullable | — |
| decided_at | timestamptz | NN | now() |
| execution_id | uuid | NN, FK operation_executions.id | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Actual eligible human reviewer.
- Authority/thresholds follow approved purchasing policy.
- Decision identifies the frozen content.
- Conflicting/superseded decisions require explicit effective-decision rules.
- This schema does not grant cancellation authority to a role.

## 6. Stock returns

### 6.1 stock_returns

Purpose:
Prepare a traceable supplier return or return of previously issued unused stock.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| return_number | text | NN, UQ | — |
| return_kind | text | NN | — |
| project_id | uuid | Nullable, FK projects.id | — |
| vendor_id | uuid | Nullable, FK vendors.id | — |
| reason | text | NN | — |
| return_state | text | NN | 'draft' |
| submitted_at | timestamptz | Nullable | — |
| posted_transaction_id | uuid | Nullable, FK stock_transactions.id, UQ | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed kinds:
supplier_return, unused_issue_return.

Proposed states:
draft, submitted, approved, rejected, posted, withdrawn.

Rules:
- Supplier return references the correct supplier/source receiving.
- Unused issue return references an eligible original stock issue.
- Tracked site-to-warehouse relocation uses stock_transfers instead.
- Submitted return content is frozen.
- Posted content and source effects are immutable.
- Return policy, physical custody and authority require approval.
- Supplier credit/refund is separate from physical return.

### 6.2 stock_return_items

Purpose:
Identify material quantities and their original physical source.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| stock_return_id | uuid | NN, FK stock_returns.id | — |
| line_number | integer | NN | — |
| goods_receipt_item_id | uuid | Nullable, FK goods_receipt_items.id | — |
| stock_issue_item_id | uuid | Nullable, FK stock_issue_items.id | — |
| material_id | uuid | NN, FK materials.id | — |
| unit_code | text | NN, FK units.code | — |
| stock_location_id | uuid | NN, FK stock_locations.id | — |
| quantity | numeric(18,4) | NN | — |
| condition_notes | text | Nullable | — |

Uniqueness:
(stock_return_id, line_number).

Rules:
- Positive quantity.
- Exactly one source item.
- Supplier-return kind requires goods_receipt_item_id.
- Unused-issue-return kind requires stock_issue_item_id.
- Material/unit/source relationships agree.
- Supplier return decreases stock at stock_location_id.
- Unused issue return increases stock at the eligible receiving location.
- Validate physical availability and cumulative source return limits.
- Do not return already consumed material as unused without evidence.
- Quarantine/disposition follows approved policy.

### 6.3 stock_return_decisions

Purpose:
Append-only review of frozen return requests.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| stock_return_id | uuid | NN, FK stock_returns.id | — |
| reviewer_employee_id | uuid | NN, FK employees.id | — |
| decision | text | NN | — |
| reason | text | Nullable | — |
| decided_at | timestamptz | NN | now() |
| execution_id | uuid | NN, FK operation_executions.id | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Approved authority policy required.
- Review references the submitted frozen request.
- No role authority is inferred.
- Posting requires an eligible effective decision where policy requires it.

### 6.4 stock_return_postings

Purpose:
Map returned quantities to exact ledger entries.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| return_item_id | uuid | NN, FK stock_return_items.id, UQ | — |
| movement_entry_id | uuid | NN, FK stock_movement_entries.id, UQ | — |

Primary key:
(return_item_id, movement_entry_id).

Rules:
- Entry belongs to the return's posted transaction.
- Entry sign follows return kind.
- Quantity, material, unit, location and project agree.
- Posting is idempotent.
- Source limits, reservations and fulfillment corrections are reconciled.
- Stock valuation/financial corrections remain separate required work.

## 7. Inventory evidence

### 7.1 inventory_file_links

Purpose:
Typed evidence links for stock preparation and correction workflows.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| stock_issue_id | uuid | Nullable, FK stock_issues.id | — |
| stock_transfer_id | uuid | Nullable, FK stock_transfers.id | — |
| stock_count_id | uuid | Nullable, FK stock_counts.id | — |
| stock_adjustment_id | uuid | Nullable, FK stock_adjustments.id | — |
| stock_return_id | uuid | Nullable, FK stock_returns.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| evidence_role | text | NN | — |
| linked_execution_id | uuid | NN, FK operation_executions.id | — |
| linked_at | timestamptz | NN | now() |

Rules:
- Exactly one source context.
- Prevent duplicate equivalent links.
- evidence_role is validated for its context.
- Submitted/posted evidence cannot be silently replaced.
- Downloads require source-context and file authorization.
- Evidence does not itself post stock or approve a request.

## 8. Generated-document evidence

### 8.1 generated_document_manifests

Purpose:
Record provenance for generated invoice, credit and purchase-order documents.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| invoice_version_id | uuid | Nullable, FK customer_invoice_versions.id | — |
| credit_note_id | uuid | Nullable, FK customer_credit_notes.id | — |
| purchase_order_version_id | uuid | Nullable, FK purchase_order_versions.id | — |
| file_asset_id | uuid | NN, FK file_assets.id, UQ | — |
| document_role | text | NN | — |
| template_code | text | NN | — |
| template_version | text | NN | — |
| source_content_digest | text | NN | — |
| generated_execution_id | uuid | NN, FK operation_executions.id | — |
| generated_at | timestamptz | NN | now() |

Proposed roles:
internal_preview, original_document, regenerated_copy.

Rules:
- Exactly one business source.
- Source content digest is computed from a defined canonical snapshot.
- Final generated assets require verified immutable bytes and digest.
- Original authoritative documents use eligible frozen/issued source content.
- Enforce one canonical original per source under the final document policy.
- Regenerated copy does not change the issued commercial facts.
- Template version remains identifiable.
- Generated documents do not grant sending/download authority.
- Stored output must satisfy approved UAE policy.

Quotation documents:
Continue using quotation_documents and its source/template metadata.
Do not create a second manifest row here for the same quotation document.

Supporting links:
finance_file_links and procurement_files identify supporting/accessible
relationships. The manifest identifies generated-document provenance.
They must not be mistaken for separate commercial documents.

## 9. Constraints still required

The later integrity specification must define:
- Number sequence locking and retries.
- Assignment/current-record agreement.
- Stage/pipeline agreement.
- Atomic outcome/conversion history.
- Frozen cancellation/return content.
- Approval eligibility and effective decision.
- Cancellation and cumulative return limits.
- Correct return ledger sign/source.
- Exactly-one typed contexts.
- Manifest source and canonical-original uniqueness.
- Immutable source/file relationships.
- Relevant RLS and foreign-key/query indexes.

## 10. Current status

Delivered:
Proposed supporting records for known structural gaps.

Not resolved:
All approval policies, financial valuation, client verification,
custom fields, final actor reconciliation or complete constraint design.

No database objects or tests have been executed.