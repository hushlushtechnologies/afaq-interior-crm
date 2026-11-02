# Afaq Al Manzel Interiors CRM — Financial Metric Definitions

Document version: 0.1
Phase: 0
Sprint: 02
Status: Definitions and policy questions — not implemented calculations

## 1. Purpose

Prevent ambiguous dashboard labels and double-counted project amounts.

All initial monetary reporting uses AED.

These definitions distinguish business concepts.
They do not select a tax or accounting policy.

Actual report formulas require approval, concrete source rules and tests.

## 2. Quoted value

Meaning:
The value proposed in an identified quotation version.

Source:
quotation_versions and their frozen line/calculation snapshots.

Rules:
- Identify which version is being displayed.
- Do not add all historical versions together as pipeline value.
- A quotation is not an invoice or cash receipt.
- Net/gross presentation must be explicitly labeled.

## 3. Accepted contract value

Meaning:
The accepted commercial baseline plus eligible approved commercial changes.

Sources:
- The project's accepted quotation version.
- Approved customer/internal commercial changes under DEC-006.

Rules:
- Preserve original accepted value.
- Distinguish baseline and variation effects.
- Do not replace contract value with the latest draft quotation.
- Commercial change evidence and financial effect rules remain open.

## 4. Invoiced amount

Meaning:
Eligible issued customer charges, with correction effects reported explicitly.

Sources:
- customer_invoice_issues.
- Frozen invoice versions/items.
- Eligible credit/void records.

Rules:
- Drafts do not count as issued invoices.
- An email delivery attempt is not a second invoice.
- Credit, void and period treatment require approved rules.
- Label gross amount, net amount and tax distinctly.

## 5. Received amount

Meaning:
Customer money recorded as received under approved evidence policy.

Sources:
- Posted customer_payments.
- Valid receipt corrections.
- Refund records, displayed with appropriate separate treatment.

Rules:
- Invoice issuance does not increase received cash.
- Allocation does not receive the money again.
- A receipt correction and an actual refund are distinct.
- Gross receipts and net retained customer funds must not share an ambiguous label.

## 6. Allocated receipt amount

Meaning:
Eligible receipt amounts applied to a particular issued invoice.

Sources:
- customer_payment_allocations.
- Valid allocation reversals.

Rules:
- Allocation cannot exceed eligible available receipt funds.
- Settlement cannot exceed permitted invoice balance.
- Shared receipts require safe project-specific reporting.
- Releasing an allocation is not proof of a cash refund.

## 7. Outstanding receivable

Meaning:
An approved calculation of remaining customer invoice obligations.

Relevant sources:
Issued invoices, eligible credits/voids, valid allocations and corrections.

Open:
- Credit treatment for fully settled invoices.
- Overpayments and advances.
- Cross-project settlement.
- Reporting date and historical reconstruction.
- Any permitted invoice adjustments.

Do not publish a final formula until these are resolved.

## 8. Project budget

Meaning:
The effective approved project cost plan.

Sources:
project_budgets, frozen budget versions/items and approved decisions.

Rules:
- Identify the effective baseline version.
- Do not sum superseded budget versions.
- A budget is not spending authority by itself.
- Original and revised budget comparisons must be labeled.

## 9. Authorized purchase value

Meaning:
Approved issued purchasing obligations attributable to a project,
with approved amendments/cancellations.

Sources:
Eligible order issues/items and commitment establishment/change events.

Rules:
- Draft orders do not count.
- Resending the same order does not add another obligation.
- An amendment adds its true change, not another full original value.
- Warehouse purchases are not automatically project-specific.

## 10. Remaining commitment

Meaning:
The eligible purchasing amount not yet replaced or relieved under the
approved cost recognition policy.

Sources:
project_commitments and valid project_commitment_events.

Rules:
- Distinguish remaining commitment from original authorized order value.
- Actualization relief is not order cancellation.
- Supplier payment does not automatically determine commitment relief.
- Concurrency must prevent duplicate relief.
- Disputed, cancelled and partially fulfilled items need approved treatment.

## 11. Actual project cost

Meaning:
Costs recognized for a project under an approved management reporting policy.

Source:
project_actual_cost_entries and their traceable source/correction records.

Rules:
- Do not sum bill totals, expenses and registry entries together.
- The registry identifies recognized effects, not a second copy of spend.
- Warehouse inventory requires an approved valuation/consumption policy.
- Recoverable/nonrecoverable tax treatment is not assumed.
- Billing date, recording date and recognition date are distinguishable.

## 12. Forecast or expected final cost

Possible meaning:
Actual recognized cost plus eligible remaining commitments plus approved
estimates of work not yet committed.

Status:
Proposed management metric.

Open:
- Whether estimates-to-complete are required.
- Who maintains them.
- How commitments and forecasts avoid overlap.
- Whether additional forecast records are needed.

Do not label actual plus remaining commitments as guaranteed final cost.

Do not create editable forecast totals without an approved source model.

## 13. Margin and profitability

Possible measures:
- Quotation margin.
- Contract-versus-budget margin.
- Contract-versus-recognized-cost comparison.
- Forecast final project margin.
- Cash received versus cash paid.

These are different measures.

Open:
- Which measure the business calls project profit.
- Revenue recognition basis.
- Cost recognition basis.
- Tax inclusion/exclusion.
- Overhead treatment.
- Inventory valuation.
- Treatment of incomplete projects.

Until approved:
Use descriptive labels and do not present one provisional number as
final accounting profit.

## 14. Illustrative commitment reconciliation

Example only — not an approved policy:

- Authorized order basis: AED 1,000.
- Actual recognized supplier cost for one completed portion: AED 420.
- Order-basis amount replaced by that portion: AED 400.
- Remaining commitment: AED 600.
- Recognized actual plus remaining commitment: AED 1,020.
- Difference between matched actual and original order basis: AED 20.

The example shows why:
- Actual cost and commitment relief may differ.
- Relieving AED 400 does not erase the original order.
- Adding the entire AED 1,000 order to AED 420 actual would double count
  the portion already replaced.

Whether this treatment is appropriate requires business approval.

## 15. Illustrative warehouse boundary

Example only:

Materials are purchased for the central warehouse and later used across projects.

Recording the supplier bill establishes source evidence.
Moving materials to a site changes their location.
Consuming materials may create a project cost under the approved policy.

Do not automatically record the full warehouse purchase as a project cost
and then charge the same material again when issued.

The valuation method must be selected before this becomes a final calculation.

## 16. Shared-source privacy

A supplier bill, expense or customer receipt may concern several projects.

A PM authorized for one project should receive:
- That project's permitted allocated amounts.
- Relevant authorized details.
- Required document evidence only where permitted.

Do not reveal:
- Another project's allocation.
- Unrelated customer transactions.
- A shared source's total when that would expose restricted amounts.
- Private bank or personal details without permission.

## 17. Reporting date requirements

Each report must identify:
- Business reporting period.
- Timezone where timestamps affect boundaries.
- Whether it uses document, receipt, recognition or posting dates.
- Treatment of later corrections.
- Whether figures are current or reconstructed as of a past date.

Initial business timezone:
Asia/Dubai.

Never silently mix different date bases in one comparison.

## 18. Questions required before final financial calculations

1. How should project profit be defined for management?
2. When does a direct purchase become an actual project cost?
3. How should warehouse stock be valued and charged to projects?
4. Which taxes are included in project cost and which are excluded?
5. How are overhead costs treated?
6. Which purchase approval thresholds and delegates apply?
7. Which correction, credit, refund and void scenarios are permitted?
8. Are customer funds allowed to settle different projects for the same client?
9. Is supplier payment and payable settlement tracking required initially?
10. Are estimates-to-complete and forecast final costs required?

Do not treat the absence of answers as approval of an example.

## 19. Verification expectations

When implemented, test:
- Source totals reconcile with recognized costs.
- Duplicate source posting is prevented.
- Partial bill/receipt matches respect quantity and amount limits.
- Corrections preserve historical evidence.
- Commitment relief cannot happen twice.
- Warehouse costs are not charged twice.
- Shared-source reporting does not disclose unrelated projects.
- Tax and rounding follow the approved policy.
- Report date boundaries and corrections are consistent.
- Relevant concurrent posting/allocation operations remain safe.

No financial calculations or tests have been executed in Sprint 02.

## 20. Current status

Financial concepts are distinguished and policy questions are documented.

Final formulas, inventory valuation and financial operational authority
remain unresolved.

This document does not certify accounting or tax compliance.