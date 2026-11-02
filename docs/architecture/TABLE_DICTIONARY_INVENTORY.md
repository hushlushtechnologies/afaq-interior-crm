# Afaq Al Manzel Interiors CRM — Inventory Dictionary

Document version: 0.1
Phase: 0
Sprint: 02
Status: Proposed physical design

## 1. Scope and conventions

Defines:
- Warehouse, project-site, quarantine and transit locations.
- Stock transaction headers and movement entries.
- Balance projections and concurrency controls.
- Reservations.
- Transfers and receipts.
- Counts and adjustments.
- Site-request fulfillment.

Uses DATABASE_CONVENTIONS.md.

Common Mutable Columns and Archive Columns include their complete
definitions from that document.

Default — means no database default.

Quantity precision is proposed numeric(18,4), pending confirmation.
No automatic unit conversions initially.

## 2. Inventory principles

- Materials and units have stable identities.
- Posted stock effects are append-only.
- Balances reconcile with posted ledger entries.
- Transfers preserve quantity integrity.
- Reservations reduce availability without moving physical stock.
- Quarantine is not ordinary available stock.
- Refused supplier goods do not become on-hand inventory.
- Negative-stock exceptions require an approved policy and explicit controls.
- No such exception authority is granted by this dictionary.
- Financial stock valuation is not selected here.

## 3. Stock locations

### 3.1 stock_locations

Purpose:
Identify physical or explicitly tracked in-transit stock positions.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| code | text | NN, UQ | — |
| name | text | NN | — |
| location_kind | text | NN | — |
| project_id | uuid | Nullable, FK projects.id | — |
| parent_location_id | uuid | Nullable, FK stock_locations.id | — |
| address_description | text | Nullable | — |

Proposed kinds:
warehouse, project_site, quarantine, transit.

Rules:
- A project_site location requires a project.
- Central warehouse may have no project.
- Quarantine/transit project attribution follows the actual context.
- Parent relationships cannot form cycles.
- Parent/project relationships must not conflict.
- Location kind cannot be changed to reinterpret posted history.
- Quarantine/transit stock cannot be treated as normal available site stock.
- A location cannot be archived to hide existing balances or obligations.

## 4. Posted ledger

### 4.1 stock_transactions

Purpose:
Atomic business identity for a group of posted stock movements.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| transaction_number | text | NN, UQ | — |
| transaction_kind | text | NN | — |
| effective_at | timestamptz | NN | — |
| posted_at | timestamptz | NN | now() |
| posted_by | uuid | NN, FK employees.id | — |
| reason | text | Nullable | — |
| reverses_transaction_id | uuid | Nullable, FK stock_transactions.id | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed kinds:
goods_receipt, issue, transfer_dispatch, transfer_receipt,
adjustment, return, reversal.

Rules:
- This table represents posted effects, not editable preparation.
- Header, movement entries, source links and balance changes commit together.
- Reversal references a real eligible prior transaction.
- A reversal cannot bypass stock availability or approved correction rules.
- Business effective time is distinct from posting time.
- Backdating policy remains open.
- No arbitrary editing or deletion after posting.

### 4.2 stock_movement_entries

Purpose:
Signed quantity changes for identified material/location pairs.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| stock_transaction_id | uuid | NN, FK stock_transactions.id | — |
| line_number | integer | NN | — |
| material_id | uuid | NN, FK materials.id | — |
| location_id | uuid | NN, FK stock_locations.id | — |
| unit_code | text | NN, FK units.code | — |
| quantity_delta | numeric(18,4) | NN | — |
| project_id | uuid | Nullable, FK projects.id | — |

Uniqueness:
(stock_transaction_id, line_number).

Rules:
- quantity_delta is nonzero.
- Positive means entering the location.
- Negative means leaving the location.
- Unit must agree with the material.
- Project attribution must agree with location/source purpose.
- Transfer posting sums to zero per material/unit across its locations.
- External receipt/consumption transactions have different valid patterns;
  not every transaction must sum to zero.
- Source-specific quantity reconciliation is mandatory.
- Entries are immutable after posting.

### 4.3 stock_balances

Purpose:
Transactionally maintained projection used for fast availability checks.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| material_id | uuid | NN, FK materials.id | — |
| location_id | uuid | NN, FK stock_locations.id | — |
| on_hand_quantity | numeric(18,4) | NN | 0 |
| reserved_quantity | numeric(18,4) | NN | 0 |
| balance_version | bigint | NN | 0 |
| updated_at | timestamptz | NN | now() |

Primary key:
(material_id, location_id).

Rules:
- Unit follows the material's controlled unit.
- Users cannot directly edit this table.
- Posting operations lock affected balance rows in deterministic order.
- on_hand reconciles with posted movement entries.
- reserved reconciles with reservation events.
- Increment balance_version for relevant stock/reservation changes.
- Availability uses the approved location and reservation rules.
- Concurrent creation of missing balance rows must be handled safely.
- Ledger reconciliation must detect projection discrepancies.

### 4.4 goods_receipt_stock_links

Purpose:
Connect receiving lines to their exact stock effects.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| goods_receipt_item_id | uuid | NN, FK goods_receipt_items.id | — |
| stock_movement_entry_id | uuid | NN, FK stock_movement_entries.id, UQ | — |
| disposition | text | NN | — |

Primary key:
(goods_receipt_item_id, stock_movement_entry_id).

Proposed dispositions:
accepted, quarantine.

Rules:
- Linked entry is positive and belongs to the matching receipt transaction.
- Material, unit, location and quantity agree with receiving disposition.
- No entry for refused quantity.
- Sum of linked effects matches posted receiving quantities.
- Idempotent receipt posting cannot duplicate these effects.

## 5. Stock issues

### 5.1 stock_issues

Purpose:
Prepare and authorize consumption/issue from a stock location.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| issue_number | text | NN, UQ | — |
| source_location_id | uuid | NN, FK stock_locations.id | — |
| project_id | uuid | Nullable, FK projects.id | — |
| purpose | text | NN | — |
| issue_status | text | NN | 'draft' |
| posted_transaction_id | uuid | Nullable, FK stock_transactions.id, UQ | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
draft, submitted, posted, cancelled_before_posting.

Rules:
- Consumption is distinct from transfer to another tracked location.
- Posting requires approved authority and available stock.
- Posted source documents are frozen.
- Project allocation and source-location policy must agree.
- No implicit issue from quarantine.
- Return handling requires explicit source/reversal evidence.

### 5.2 stock_issue_items

Purpose:
Requested material quantities for an issue.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| stock_issue_id | uuid | NN, FK stock_issues.id | — |
| line_number | integer | NN | — |
| material_id | uuid | NN, FK materials.id | — |
| unit_code | text | NN, FK units.code | — |
| quantity | numeric(18,4) | NN | — |
| posted_movement_entry_id | uuid | Nullable, FK stock_movement_entries.id, UQ | — |

Uniqueness:
(stock_issue_id, line_number).

Rules:
- Positive preparation quantity.
- Posted entry is negative with matching material/unit/source.
- Posting cannot exceed permitted available stock.
- A physical movement is represented once in the ledger.

## 6. Reservations

### 6.1 stock_reservations

Purpose:
Identify a project/request claim against stock availability.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| material_id | uuid | NN, FK materials.id | — |
| location_id | uuid | NN, FK stock_locations.id | — |
| project_id | uuid | NN, FK projects.id | — |
| site_request_item_id | uuid | Nullable, FK site_material_request_items.id | — |
| requested_quantity | numeric(18,4) | NN | — |
| expires_at | timestamptz | Nullable | — |

Rules:
- Requested quantity is positive.
- Request/material/project/unit relationships must agree.
- Actual held quantity derives from reservation events.
- Expiry must trigger a controlled release, not silently alter ledger meaning.
- Reservation is not proof of physical site delivery.
- Requested quantity does not itself reserve stock.

### 6.2 stock_reservation_events

Purpose:
Append-only holds, releases and consumption of reserved availability.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| reservation_id | uuid | NN, FK stock_reservations.id | — |
| event_kind | text | NN | — |
| quantity | numeric(18,4) | NN | — |
| source_movement_entry_id | uuid | Nullable, FK stock_movement_entries.id | — |
| reason | text | Nullable | — |
| occurred_at | timestamptz | NN | now() |
| performed_by | uuid | NN, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed kinds:
hold, release, consume.

Rules:
- All event quantities are positive.
- Held balance equals holds minus releases minus consumed quantities.
- Held balance cannot become negative.
- New holds cannot exceed permitted available stock.
- Consume requires a matching negative movement from the reserved location.
- Total reservation consumption cannot exceed the associated movement.
- Movement and reservation consumption commit consistently.
- Release does not move physical stock.

## 7. Transfers

### 7.1 stock_transfers

Purpose:
Move materials between tracked locations with optional transit tracking.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| transfer_number | text | NN, UQ | — |
| source_location_id | uuid | NN, FK stock_locations.id | — |
| destination_location_id | uuid | NN, FK stock_locations.id | — |
| transit_location_id | uuid | Nullable, FK stock_locations.id | — |
| project_id | uuid | Nullable, FK projects.id | — |
| transfer_status | text | NN | 'draft' |
| requested_delivery_date | date | Nullable | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
draft, submitted, in_transit, partially_received, received,
cancelled_before_dispatch.

Rules:
- Source and destination differ.
- Transit, if used, is distinct and correctly classified.
- Direct transfer uses one balanced posting.
- Transit transfer uses source-to-transit dispatch and transit-to-destination receipt.
- No cancellation may silently erase already dispatched quantities.
- Remaining, returned, lost or damaged quantities need explicit reconciliation.
- Posting and receiving authority require approved policy.

### 7.2 stock_transfer_items

Purpose:
Requested material quantities for a transfer.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| transfer_id | uuid | NN, FK stock_transfers.id | — |
| line_number | integer | NN | — |
| material_id | uuid | NN, FK materials.id | — |
| unit_code | text | NN, FK units.code | — |
| requested_quantity | numeric(18,4) | NN | — |
| site_request_item_id | uuid | Nullable, FK site_material_request_items.id | — |

Uniqueness:
(transfer_id, line_number).

Rules:
- Positive quantity.
- Material/unit compatibility.
- Site request/project relationships agree.
- Actual dispatch/receipt derives from postings, not an editable counter.
- Partial dispatch/receipt behavior must be explicit.

### 7.3 stock_transfer_postings

Purpose:
Connect transfer stages to exact balanced stock effects.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| transfer_item_id | uuid | NN, FK stock_transfer_items.id | — |
| stage | text | NN | — |
| stock_transaction_id | uuid | NN, FK stock_transactions.id | — |
| source_entry_id | uuid | NN, FK stock_movement_entries.id, UQ | — |
| destination_entry_id | uuid | NN, FK stock_movement_entries.id, UQ | — |
| quantity | numeric(18,4) | NN | — |
| recorded_at | timestamptz | NN | now() |

Proposed stages:
direct, dispatch, receipt.

Rules:
- Quantity is positive.
- Both entries belong to the same specified transaction.
- Entries have opposite equal quantities and matching material/unit.
- Locations agree with transfer stage.
- Direct and staged paths cannot double-post the same fulfillment.
- Receipts cannot exceed eligible dispatched/in-transit quantity.
- Transfer progress is calculated from valid postings.
- Concurrency must protect remaining quantities.

## 8. Physical counts

### 8.1 stock_counts

Purpose:
Coordinate a physical count at a location.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| count_number | text | NN, UQ | — |
| location_id | uuid | NN, FK stock_locations.id | — |
| count_status | text | NN | 'draft' |
| started_at | timestamptz | Nullable | — |
| completed_at | timestamptz | Nullable | — |
| notes | text | Nullable | — |

Proposed states:
draft, counting, submitted, reconciled, cancelled.

Rules:
- A count does not change stock automatically.
- Counting method and movement-freeze policy require business confirmation.
- Concurrent movements must be accounted for before adjustment.
- Completed count evidence is preserved.

### 8.2 stock_count_items

Purpose:
Observed quantity and comparison evidence for one material.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| stock_count_id | uuid | NN, FK stock_counts.id | — |
| material_id | uuid | NN, FK materials.id | — |
| unit_code | text | NN, FK units.code | — |
| expected_quantity_snapshot | numeric(18,4) | NN | — |
| observed_quantity | numeric(18,4) | Nullable | — |
| balance_version_snapshot | bigint | NN | — |
| observed_at | timestamptz | Nullable | — |
| observed_by | uuid | Nullable, FK employees.id | — |
| notes | text | Nullable | — |

Uniqueness:
(stock_count_id, material_id).

Rules:
- Zero observed quantity is distinct from not counted.
- Validate unit and nonnegative physical observation.
- A changed balance version requires reconciliation before adjustment.
- A version snapshot alone does not solve physical movement during counting.
- Preserve recount/correction evidence under the approved count process.

## 9. Adjustments

### 9.1 stock_adjustments

Purpose:
Prepare a reasoned, authorized quantity correction.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| adjustment_number | text | NN, UQ | — |
| location_id | uuid | NN, FK stock_locations.id | — |
| stock_count_id | uuid | Nullable, FK stock_counts.id | — |
| reason_code | text | NN | — |
| explanation | text | NN | — |
| adjustment_status | text | NN | 'draft' |
| submitted_at | timestamptz | Nullable | — |
| posted_transaction_id | uuid | Nullable, FK stock_transactions.id, UQ | — |
| idempotency_key | uuid | NN, UQ | — |

Proposed states:
draft, submitted, approved, rejected, posted, withdrawn.

Rules:
- Submitted content is frozen.
- Changed adjustment content requires a replacement request.
- Approval authority and reason catalogue require business policy.
- Count location must agree with adjustment location.
- Posted corrections retain original ledger history.

### 9.2 stock_adjustment_items

Purpose:
Signed proposed correction quantities.

Includes:
Common Mutable Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| adjustment_id | uuid | NN, FK stock_adjustments.id | — |
| material_id | uuid | NN, FK materials.id | — |
| unit_code | text | NN, FK units.code | — |
| quantity_delta | numeric(18,4) | NN | — |
| count_item_id | uuid | Nullable, FK stock_count_items.id | — |
| posted_movement_entry_id | uuid | Nullable, FK stock_movement_entries.id, UQ | — |

Uniqueness:
(adjustment_id, material_id).

Rules:
- Nonzero delta.
- Count item/material/location must agree where linked.
- Posting validates stock/reservation implications.
- Do not use adjustment to bypass purchasing/receiving or hide theft/damage.
- Posted movement matches the approved correction.

### 9.3 stock_adjustment_decisions

Purpose:
Append-only review of frozen adjustment content.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| adjustment_id | uuid | NN, FK stock_adjustments.id | — |
| reviewer_employee_id | uuid | NN, FK employees.id | — |
| decision | text | NN | — |
| reason | text | Nullable | — |
| decided_at | timestamptz | NN | now() |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Eligible approved authority required.
- No ordinary editor can approve by changing adjustment_status directly.
- Decision validity and concurrency require controlled operations.
- Rejected/changed content cannot silently reuse prior approval.

## 10. Site-request fulfillment

### 10.1 site_material_fulfillments

Purpose:
Trace actual delivered usable materials to a site request.

Columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| id | uuid | NN, PK | gen_random_uuid() |
| site_request_item_id | uuid | NN, FK site_material_request_items.id | — |
| destination_movement_entry_id | uuid | NN, FK stock_movement_entries.id | — |
| quantity | numeric(18,4) | NN | — |
| recorded_at | timestamptz | NN | now() |
| recorded_by | uuid | NN, FK employees.id | — |
| idempotency_key | uuid | NN, UQ | — |

Rules:
- Positive allocation quantity.
- Entry must represent eligible positive usable stock at the requested
  project's site location.
- Material/unit/project must agree.
- Reservations and purchase orders do not count as physical fulfillment.
- Quarantine delivery is not usable fulfillment.
- Multiple allocations cannot exceed the source entry's eligible quantity.
- Total fulfillment cannot exceed the approved request/exception policy.
- Reversal/return must correct the fulfillment interpretation traceably.
- A subsequent consumption issue must not count the same delivery twice.

Proposed initial boundary:
Count site delivery through eligible destination stock postings.

Open:
Whether an approved direct-to-consumption fulfillment route is needed.
Do not implement one implicitly or lose inventory traceability.

## 11. Inventory alerts

### 11.1 stock_alert_rules

Purpose:
Configurable low-stock thresholds for material/location pairs.

Includes:
Common Mutable Columns.
Archive Columns.

Additional columns:

| Column | Type | Nullability | Default |
| --- | --- | --- | --- |
| material_id | uuid | NN, FK materials.id | — |
| location_id | uuid | NN, FK stock_locations.id | — |
| threshold_quantity | numeric(18,4) | NN | — |
| is_enabled | boolean | NN | true |

Uniqueness:
(material_id, location_id).

Rules:
- Nonnegative threshold.
- Unit follows the material.
- Alert calculation must distinguish on-hand and available quantity
  according to the approved setting/policy.
- Notification recipients require authorized scope.
- Repeated checks must not create uncontrolled notification duplicates.

## 12. Returns, damage and reversals

Required behavior:
- Preserve original source and movement references.
- Determine whether goods remain in custody.
- Move retained damaged material to an appropriate controlled location.
- Record supplier returns through approved physical and commercial processes.
- Keep financial credit/refund handling separate.
- Reconcile reservations and fulfillment when correcting movements.

Unresolved:
Detailed return authorization, replacement flows, damaged-stock disposal,
loss handling and supplier dispute policy.

The transaction kind values are not a complete implemented returns workflow.

Before final schema approval:
Resolve these flows or explicitly add the necessary source-document and
decision records. Do not claim returns are complete merely because a
ledger can represent a signed quantity.

## 13. Required constraints and concurrency controls

The later technical documents must specify:
- Material/unit consistency.
- Location/project consistency.
- Posted-source immutability.
- Ledger/source reconciliation.
- Deterministic balance-row locking.
- Transactional reservation updates.
- Safe partial transfer/receipt accounting.
- Adjustment decision validity.
- Count reconciliation.
- Fulfillment allocation limits.
- Correction/reversal eligibility.
- Applicable RLS and restricted posting functions.
- Foreign-key and operational-query indexes.

## 14. Reporting

Inventory reports derive from:
- Materials and locations.
- Posted ledger.
- Reconciled balance projections.
- Reservation events.
- Transfer postings.
- Count and adjustment evidence.
- Project fulfillment links.

No manually maintained report table replaces these source records.

## 15. Current status

Delivered:
Proposed inventory, reservation, transfer, count, adjustment and
site-fulfillment schema.

Not resolved:
All stock exception policies, returns documents, valuation, final
precision, authority or detailed posting implementation.

No tables, migrations or tests have been executed.