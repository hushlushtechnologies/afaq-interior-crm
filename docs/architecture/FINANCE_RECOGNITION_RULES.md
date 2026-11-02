# Afaq Al Manzel Interiors CRM — Finance Recognition Rules

Document version: 0.1
Phase: 0
Sprint: 02
Status: Accepted recognition direction with unresolved policy boundaries

## 1. Accepted decision

For internal project reporting, recognize eligible direct project costs
when Finance posts the supplier bill or expense.

Do not wait for cash payment.

This defines the trigger for eligible direct costs.
It does not establish complete accounting, tax or profitability policy.

## 2. Eligible direct cost source

Require:
- Posted supplier bill or expense.
- Valid direct-project allocation.
- Authorized project/category attribution.
- Approved cost basis.
- Required evidence.
- Approved posting authority.
- No duplicate recognition.
- Defined recognition date.

Unknown cost basis is not zero.
Tax inclusion/exclusion and date restrictions remain policy decisions.

## 3. Required posting behavior

A controlled posting operation must:
1. Validate current authority and source eligibility.
2. Validate frozen source content and allocations.
3. Check duplicate/source limits.
4. Create the authoritative posting.
5. Create required direct-project actual-cost entries.
6. Reconcile applicable purchase commitments.
7. Record required execution/audit evidence.
8. Commit required financial effects consistently.

A failed required step must not leave a partially posted financial result.

Later notifications may run separately.

## 4. Actual-cost source

Use project_actual_cost_entries as the recognized project-cost registry.

Direct source relationships:
- supplier_bill_allocations.
- project_expense_allocations.

Corrections:
- supplier_bill_correction_items.
- project_expense_corrections.
- Authorized traceable reversal relationships.

Do not calculate actual cost by adding:
bill totals + expense totals + registry entries.

That would count recognized sources again.

## 5. Cash remains separate

A supplier payment:
- Does not create the same project cost a second time.
- Does not change original bill content.
- May settle a supplier obligation if that separate workflow is approved.

Customer receipts:
- Are not supplier payments.
- Are not project revenue recognition by default.
- Do not determine whether a direct supplier cost exists.

Supplier payment/settlement tracking remains a separate scope decision.

## 6. Commitments

An eligible issued purchase creates an authorized commitment.

When a posted actual cost replaces part of it:
- Identify the corresponding source portion.
- Relieve the approved commitment basis.
- Preserve the actual amount.
- Preserve any variance.
- Prevent repeated relief.

Do not assume actual amount equals original order basis.

Do not automatically close the whole commitment after one partial bill.

## 7. Warehouse boundary

Warehouse inventory valuation remains open for Finance.

Therefore:
- Warehouse bill allocation does not automatically create direct project cost.
- Physical transfer does not automatically prove consumption.
- Inventory issue does not yet have an approved monetary valuation.
- Latest supplier price is not an approved historical valuation method.
- Do not invent FIFO or moving weighted average.
- Do not charge warehouse purchase and subsequent usage twice.

Before implementation:
Approve valuation, cost components, recognition point, return handling,
supplier corrections and enforceable valuation-source records.

## 8. Honest financial reporting while valuation is incomplete

The production project-profitability feature cannot be accepted as complete
if required warehouse-consumption costs are missing.

During development:
Use explicit incomplete-data labels and synthetic examples.
Do not present partial direct costs as final total project costs.

Final management profit definition remains open under DEC-019.

## 9. Corrections

Preserve original posted sources and cost entries.

A correction must:
- Identify the original source.
- Use approved signed effects.
- Preserve project/category consistency.
- Respect reversal limits.
- Reconcile commitment effects.
- Record authority and evidence.
- Avoid duplicate recognition.

A reversal does not prove money was refunded.

## 10. Policy questions still open

- Tax included in recognized cost.
- Rounding and precision.
- Recognition-date restrictions/backdating.
- Approval authority.
- Shared cost and overhead allocation.
- Warehouse valuation.
- Profitability/revenue definition.
- Supplier settlement tracking.
- Financial closure gates.

No answer is implied merely by acceptance of the posting trigger.

## 11. Required tests when implemented

- Posting one eligible source creates its cost once.
- Retry creates no duplicate.
- Payment does not create a second cost.
- Partial bills relieve only the eligible commitment portion.
- Corrections preserve originals and reconcile totals.
- Concurrent posting cannot recognize the same source twice.
- Warehouse allocations do not enter as direct costs.
- PM access reveals only assigned-project financial information.
- Failed required posting steps roll back consistently.

No calculations or tests have been executed.

## 12. Current status

Direct-cost recognition trigger:
Accepted.

Warehouse valuation:
Explicitly open.

Complete Finance implementation:
Not delivered or verified.