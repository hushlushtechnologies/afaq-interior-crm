# Afaq Al Manzel Interiors CRM — Procurement Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed physical design

## 1. Scope and conventions

Defines:
- Units and materials.
- Vendors.
- Versioned purchasing requests and decisions.
- Supplier offers and comparisons.
- Versioned purchase orders and decisions.
- Partial goods receipts.

Common Mutable Columns and Archive Columns include the complete columns
defined in DATABASE_CONVENTIONS.md.

Default — means no database default.

Referenced tables from other dictionary documents:
- employees, projects and client-related records: core.
- site_material_request_items: project operations.
- file_assets: planned platform dictionary.
- stock_locations and stock_transactions: inventory.

All definitions are proposals for Sprint 02 review.

## 2. Important commercial boundaries

- Request approval does not automatically authorize any supplier order.
- Approval must identify the exact commercial content reviewed.
- An issued order must preserve its commercial details.
- Partial receiving is separate from supplier billing.
- Supplier bills, expenses and payments belong to Finance.
- Receipt submission must not duplicate stock effects.
- Approval thresholds and delegation remain open under DEC-016.
- No purchasing authority is invented by this dictionary.

## 3. Units and catalogue

### 3.1 units

Purpose:
Controlled units used by commercial and stock quantities.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| name | text | NN | — |
| dimension | text | NN | — |
| allows_fractional_quantity | boolean | NN | — |

Proposed dimensions:
count, length, area, volume, mass, other.

Rules:
- Referencing tables may use units.code as a foreign key.
- No automatic conversion initially.
- Whether quantities must be whole numbers follows the unit configuration.
- Existing referenced codes cannot be silently renamed.
- Required units and exact precision must be confirmed.

### 3.2 material_categories

Purpose:
Organize the material catalogue.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| name | text | NN | — |
| description | text | Nullable | — |

Rules:
Archiving preserves material references and historical meaning.

### 3.3 materials

Purpose:
Stable identity for physical material purchasing and stock.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| sku | text | NN, UQ | — |
| name | text | NN | — |
| description | text | Nullable | — |
| category_id | uuid | Nullable, FK material_categories.id | — |
| unit_code | text | NN, FK units.code | — |
| specification | text | Nullable | — |

Rules:
- Quantities use this material's approved unit.
- No implicit conversion from supplier packaging units.
- Changing the unit after commercial/stock usage requires a controlled
  migration or a distinct material identity; do not silently reinterpret history.
- A catalogue material is not a stock balance.
- Supplier prices belong to specific offers/orders, not one historical
  price field on this record.
- Service order lines may use descriptions without pretending services
  are physical stock.

## 4. Vendors

### 4.1 vendors

Purpose:
Supplier identity and purchasing information.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| vendor_number | text | NN, UQ | — |
| display_name | text | NN | — |
| legal_name | text | Nullable | — |
| tax_registration_number | text | Nullable | — |
| address_text | text | Nullable | — |
| payment_terms_summary | text | Nullable | — |
| notes | text | Nullable | — |

Rules:
- Vendor name is not a reliable duplicate-prevention key.
- Vendor archive must preserve existing order/bill references.
- Sensitive financial/payment details require separate Finance controls.
- Do not store provider credentials here.

### 4.2 vendor_contacts

Purpose:
Named supplier contacts.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| vendor_id | uuid | NN, FK vendors.id | — |
| full_name | text | NN | — |
| email | text | Nullable | — |
| phone | text | Nullable | — |
| is_primary | boolean | NN | false |

Rules:
- At most one active primary contact per vendor under this proposal.
- Shared contact information is not automatically globally unique.
- Order recipient snapshots must preserve what was actually used.

## 5. Purchase requests

### 5.1 purchase_requests

Purpose:
Stable identity across request revisions.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| request_number | text | NN, UQ | — |
| project_id | uuid | Nullable, FK projects.id | — |
| requesting_employee_id | uuid | NN, FK employees.id | — |

Rules:
- Nullable project supports approved central warehouse/company purchases.
- A project request must remain attributable to its project.
- Project reassignment after submission requires controlled revision,
  not silent alteration of approved scope.
- A request may have multiple versions, each with its own review.

### 5.2 purchase_request_versions

Purpose:
Freeze the exact request details submitted for approval.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| purchase_request_id | uuid | NN, FK purchase_requests.id | — |
| version_number | integer | NN | — |
| title | text | NN | — |
| justification | text | NN | — |
| required_by | date | Nullable | — |
| currency_code | text | NN | 'AED' |
| estimated_total_amount | numeric(18,2) | Nullable | — |
| preparation_state | text | NN | 'draft' |
| submitted_at | timestamptz | Nullable | — |
| submitted_by | uuid | Nullable, FK employees.id | — |

Uniqueness:
(purchase_request_id, version_number).

Proposed states:
draft, submitted, withdrawn.

Rules:
- AED only initially.
- Submitted content and its items are frozen.
- Revised content creates another version.
- Unknown estimated cost is not zero.
- Approval policy must define whether a request without a priced estimate
  can be approved and by whom.
- Approval cannot be inferred from preparation_state alone.

### 5.3 purchase_request_items

Purpose:
Requested items within one version.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| request_version_id | uuid | NN, FK purchase_request_versions.id | — |
| line_number | integer | NN | — |
| site_request_item_id | uuid | Nullable, FK site_material_request_items.id | — |
| item_kind | text | NN | — |
| material_id | uuid | Nullable, FK materials.id | — |
| description | text | NN | — |
| quantity | numeric(18,4) | NN | — |
| unit_code | text | NN, FK units.code | — |
| estimated_unit_price | numeric(18,6) | Nullable | — |
| notes | text | Nullable | — |

Uniqueness:
(request_version_id, line_number).

Proposed kinds:
material, service.

Rules:
- Positive quantities.
- Material/unit compatibility where a catalogue material is selected.
- A linked site item must belong to the request's project.
- Requested purchasing quantity and original site quantity are distinct;
  approved splitting/overage rules are not assumed.
- Service lines do not create physical stock.
- Submitted version items are immutable.

### 5.4 purchase_request_decisions

Purpose:
Append-only decisions against exact request versions.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| request_version_id | uuid | NN, FK purchase_request_versions.id | — |
| decision | text | NN | — |
| reviewer_employee_id | uuid | NN, FK employees.id | — |
| decided_at | timestamptz | NN | now() |
| reason | text | Nullable | — |
| authority_policy_snapshot | jsonb | NN | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed decisions:
approved, rejected, changes_requested.

Rules:
- Validate the actual approved authority policy.
- Never invent approval thresholds.
- A decision does not authorize different request content.
- Multi-step approval and final eligibility require the approved policy.
- Snapshot contains safe policy identifiers/parameters, not credentials.
- Concurrency/supersession rules must prevent contradictory effective decisions.

## 6. Supplier offers

### 6.1 supplier_quotations

Purpose:
Preserve a specific supplier offer for comparison and ordering.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| vendor_id | uuid | NN, FK vendors.id | — |
| request_version_id | uuid | Nullable, FK purchase_request_versions.id | — |
| supplier_reference | text | Nullable | — |
| received_date | date | NN | — |
| valid_until | date | Nullable | — |
| currency_code | text | NN | 'AED' |
| terms_snapshot | text | Nullable | — |
| source_file_asset_id | uuid | Nullable, FK file_assets.id | — |
| offer_state | text | NN | 'draft' |
| frozen_at | timestamptz | Nullable | — |

Proposed states:
draft, recorded, withdrawn.

Rules:
- Recorded offer content is preserved.
- A changed supplier offer is a new offer record, not a silent replacement.
- Supplier reference uniqueness, if enforced, is vendor-scoped and must
  accommodate legitimate supplier behavior.
- Offers are not purchasing approvals.

### 6.2 supplier_quotation_items

Purpose:
Supplier line-level pricing and delivery information.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| supplier_quotation_id | uuid | NN, FK supplier_quotations.id | — |
| request_item_id | uuid | Nullable, FK purchase_request_items.id | — |
| line_number | integer | NN | — |
| material_id | uuid | Nullable, FK materials.id | — |
| description | text | NN | — |
| quantity | numeric(18,4) | NN | — |
| unit_code | text | NN, FK units.code | — |
| unit_price | numeric(18,6) | NN | — |
| delivery_notes | text | Nullable | — |

Uniqueness:
(supplier_quotation_id, line_number).

Rules:
- Request-item link must match the referenced request version.
- Do not compare prices as equivalent when units/specifications differ.
- Recorded offer lines are frozen.
- Final tax/discount treatment is represented by the approved commercial
  calculation model, not guessed from this table.

Comparison:
A comparison view joins eligible offers, items and request context.
It does not need a separate copied comparison table initially.

## 7. Purchase orders

### 7.1 purchase_orders

Purpose:
Stable supplier order identity.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| order_number | text | NN, UQ | — |
| vendor_id | uuid | NN, FK vendors.id | — |

Rules:
- Vendor identity is fixed for issued commercial history.
- Each issue/amendment references an approved version.
- Order status is derived from explicit issue, receipt and cancellation
  operations, not an unrestricted editable text field.

### 7.2 purchase_order_versions

Purpose:
Preserve ordered commercial content.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| purchase_order_id | uuid | NN, FK purchase_orders.id | — |
| version_number | integer | NN | — |
| currency_code | text | NN | 'AED' |
| vendor_name_snapshot | text | NN | — |
| vendor_address_snapshot | text | Nullable | — |
| vendor_tax_number_snapshot | text | Nullable | — |
| delivery_terms | text | Nullable | — |
| payment_terms | text | Nullable | — |
| expected_delivery_date | date | Nullable | — |
| subtotal_amount | numeric(18,2) | NN | 0 |
| discount_amount | numeric(18,2) | NN | 0 |
| tax_amount | numeric(18,2) | NN | 0 |
| total_amount | numeric(18,2) | NN | 0 |
| calculation_policy_snapshot | jsonb | NN | — |
| preparation_state | text | NN | 'draft' |
| submitted_at | timestamptz | Nullable | — |

Uniqueness:
(purchase_order_id, version_number).

Rules:
- Submitted commercial content is frozen.
- Changes create another version and applicable reapproval.
- Financial formulas and tax policy require confirmation.
- Amendment eligibility after partial receipt needs approved rules.
- Do not make receipts disappear when a later version exists.

### 7.3 purchase_order_items

Purpose:
Version-specific ordered lines and project cost attribution.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| order_version_id | uuid | NN, FK purchase_order_versions.id | — |
| line_number | integer | NN | — |
| item_kind | text | NN | — |
| material_id | uuid | Nullable, FK materials.id | — |
| project_id | uuid | Nullable, FK projects.id | — |
| supplier_quotation_item_id | uuid | Nullable, FK supplier_quotation_items.id | — |
| description | text | NN | — |
| quantity | numeric(18,4) | NN | — |
| unit_code | text | NN, FK units.code | — |
| unit_price | numeric(18,6) | NN | — |
| discount_amount | numeric(18,2) | NN | 0 |
| tax_rate | numeric(9,6) | Nullable | — |
| tax_amount | numeric(18,2) | NN | 0 |
| line_total_amount | numeric(18,2) | NN | — |

Uniqueness:
(order_version_id, line_number).

Proposed kinds:
material, service.

Rules:
- Split lines when project cost attribution differs.
- A null project supports an authorized central/company purchase.
- Goods receiving requires a valid physical material and compatible unit.
- A supplier offer item must belong to this order's vendor.
- Submitted lines are immutable.
- Purchase commitment and actual expense must not be double counted.

### 7.4 purchase_order_request_allocations

Purpose:
Trace ordered quantities back to approved requested quantities.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| order_item_id | uuid | NN, FK purchase_order_items.id | — |
| request_item_id | uuid | NN, FK purchase_request_items.id | — |
| quantity | numeric(18,4) | NN | — |
| allocated_at | timestamptz | NN | now() |
| allocated_by | uuid | NN, FK employees.id | — |

Primary key:
(order_item_id, request_item_id).

Rules:
- Positive compatible quantities.
- Source request version must have the required approval.
- Project/material/unit relationships must agree.
- Approved over-ordering and request splitting policies remain open.
- Allocations must not exceed permitted quantities under concurrency.
- Immutable with issued order content.

### 7.5 purchase_order_decisions

Purpose:
Append-only approval evidence for an exact order version.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| order_version_id | uuid | NN, FK purchase_order_versions.id | — |
| decision | text | NN | — |
| reviewer_employee_id | uuid | NN, FK employees.id | — |
| decided_at | timestamptz | NN | now() |
| reason | text | Nullable | — |
| authority_policy_snapshot | jsonb | NN | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Exact-version approval.
- Approved thresholds/delegation required.
- No implicit PO/PM/Finance authority is granted by these columns.
- A final approval decision must be identified through a controlled policy,
  not whichever row has the latest timestamp.

### 7.6 purchase_order_issues

Purpose:
Record authorized issue of approved order content.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| order_version_id | uuid | NN, FK purchase_order_versions.id | — |
| issued_by | uuid | NN, FK employees.id | — |
| issued_at | timestamptz | NN | now() |
| recipient_snapshot | text | NN | — |
| channel | text | NN | — |
| supersedes_issue_id | uuid | Nullable, FK purchase_order_issues.id | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Issue requires eligible approvals and issue permission.
- Superseded issue belongs to the same purchase order.
- Delivery attempts are separate platform records.
- Failed external delivery must be visible.
- Resending does not create a new commitment automatically.
- Amendment/cancellation/remainder handling needs controlled operations
  defined before final implementation.

## 8. Goods receiving

### 8.1 goods_receipts

Purpose:
One delivery inspection/receiving record.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| receipt_number | text | NN, UQ | — |
| order_issue_id | uuid | NN, FK purchase_order_issues.id | — |
| supplier_delivery_reference | text | Nullable | — |
| received_at | timestamptz | NN | — |
| received_by | uuid | NN, FK employees.id | — |
| receipt_state | text | NN | 'draft' |
| inspection_notes | text | Nullable | — |
| posted_at | timestamptz | Nullable | — |
| posted_by | uuid | Nullable, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
draft, posted, cancelled_before_posting.

Rules:
- Partial deliveries create separate receipt records.
- Posted receiving content is immutable.
- Supplier delivery references aid duplicate review; they are not assumed
  globally unique.
- Posting must coordinate required stock effects consistently.
- Services require an approved service-acceptance process, not fake stock receipt.
- Corrections use traceable reversals/replacements under approved policy.

### 8.2 goods_receipt_items

Purpose:
Record delivered quantities and their disposition.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| goods_receipt_id | uuid | NN, FK goods_receipts.id | — |
| order_item_id | uuid | NN, FK purchase_order_items.id | — |
| line_number | integer | NN | — |
| material_id | uuid | NN, FK materials.id | — |
| unit_code | text | NN, FK units.code | — |
| delivered_quantity | numeric(18,4) | NN | — |
| accepted_quantity | numeric(18,4) | NN | 0 |
| quarantine_quantity | numeric(18,4) | NN | 0 |
| refused_quantity | numeric(18,4) | NN | 0 |
| accepted_location_id | uuid | Nullable, FK stock_locations.id | — |
| quarantine_location_id | uuid | Nullable, FK stock_locations.id | — |
| condition_notes | text | Nullable | — |

Uniqueness:
(goods_receipt_id, line_number).

Rules:
- Delivered quantity is positive.
- Disposition quantities are nonnegative.
- accepted + quarantine + refused equals delivered.
- Accepted quantity requires an eligible receiving location.
- Quarantine quantity requires an eligible quarantine location.
- Refused quantity does not become company on-hand stock.
- Keeping damaged material in custody versus refusing delivery requires
  approved receiving policy; classification is not automatic.
- Material/unit/order issue relationships must agree.
- Overdelivery/substitution requires approved exception handling.
- Only applicable accepted/retained quantities affect receiving fulfillment.
- Financial recognition is a separate approved Finance policy.

### 8.3 procurement_files

Purpose:
Typed private-file links for procurement evidence.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| request_version_id | uuid | Nullable, FK purchase_request_versions.id | — |
| order_version_id | uuid | Nullable, FK purchase_order_versions.id | — |
| goods_receipt_id | uuid | Nullable, FK goods_receipts.id | — |
| file_asset_id | uuid | NN, FK file_assets.id | — |
| linked_at | timestamptz | NN | now() |
| linked_by | uuid | NN, FK employees.id | — |

Rules:
- Exactly one parent context.
- Prevent duplicate parent/file links.
- Frozen/submitted document evidence cannot be silently replaced.
- File access follows the appropriate purchasing and project scope.

## 9. Required integrity mechanisms

The later constraints/transactions documents must define:
- Material/unit consistency.
- Version-specific immutable content.
- Exact reviewed-content approval.
- Approved authority-policy enforcement.
- Concurrent allocation and receiving limits.
- Correct order issue/version relationships.
- Same-project request allocation.
- Receipt disposition reconciliation.
- Exactly-once stock effects.
- Controlled amendment/cancellation behavior.
- Foreign-key and operational-query indexes.

## 10. Open decisions and coverage limits

Still open:
- Purchasing thresholds and delegation.
- Overdelivery, substitution and cancellation.
- Service acceptance.
- Returns/damage and supplier disputes.
- Monetary/quantity precision and rounding.
- Stock valuation and financial recognition.

This document is not the completed procurement implementation.
No database creation, migrations or tests have been performed.