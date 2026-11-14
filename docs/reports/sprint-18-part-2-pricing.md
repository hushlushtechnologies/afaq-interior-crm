# Sprint 18 Part 2 — Dynamic draft inputs and exact pricing

Status: computation/validation layer delivered. Sprint 18 remains in progress.
No quotation database migration, UI, approval or delivery is activated here.

## Confirmed input and interpretation

The owner confirms VAT registration, manual VAT-number entry and dynamic units,
discounts and calculation. Manual companyVatNumber is nullable draft text with
leading zeros preserved; it is not verified against a tax registry.

Dynamic calculation is implemented as recalculation when inputs change, using
the previously proposed tax-exclusive order: line discount, overall discount,
then tax, with half-up monetary rounding to two decimals. The caller must supply
the explicit s18-exclusive-discount-before-tax-half-up-v1 policy ID; no arbitrary
formula execution or policy default is accepted. This is an implementation
interpretation of the owner's continuation, not a new production tax catalog.

Units are editable text, including custom area/work labels. The earlier proposed
fixed unit list and whole-number rule for each are not imposed. No conversion.
Quantity supports four decimals, unit price six, monetary amounts two, and
percentage inputs six. Currency is explicitly AED under existing ADR-009.

## Pricing rules implemented

- Multiply quantity and unit price exactly, then round the line subtotal.
- Apply one line discount mode: none, fixed amount, or percentage.
- Apply one overall discount to the remaining subtotal.
- Allocate overall discount in cents proportionally by largest fractional
  remainder, using normalized stable item IDs for ties. Reordering does not
  alter the amounts assigned to each item.
- Calculate and round tax per line; sum net, tax and grand total.
- Require explicit taxable/rate, zero-rated or exempt treatment on every line.
  No 5% rate is inserted automatically. Positive entered rates up to 100% are
  mathematical inputs, not a claim that every rate is legally applicable.
  Approved tax configuration and resource authorization must be enforced when
  the database workflow is connected.
- Reject negative values, zero quantity, excessive discounts, unsupported
  precision, duplicate item IDs and monetary overflow beyond numeric(18,2).
- Allow zero prices and empty header-only drafts with zero totals.
- Use bigint internally; serialize all returned monetary amounts as strings.

## Contracts and boundaries

Strict schemas reject supplied totals, creator/status/source snapshot overrides,
inconsistent create/update version pairs, invalid calendar dates, duplicate
sections and links to sections outside the submitted draft. Room/lead ownership,
existing-item identity, employee authorization, concurrency and RLS need database
verification in the next part; structural validation does not prove access.

Client-facing notes and internal notes are separate. No legal/payment/validity
defaults are invented. No global company settings or existing roles are changed.
Technical resource limits are 200 items and 50 sections per request.

## Files and verification

NEW: src/features/quotations/schemas.ts, src/features/quotations/pricing.ts,
tests/unit/quotation-pricing.spec.ts and this report.
MODIFIED: playwright.quotation-unit.config.ts. Part 1 decimal.ts is unchanged.

The local quotation unit selection passes 31 tests: 8 decimal and 23 pricing/
contract tests, including 100 bounded reconciliation scenarios. A separate
local comparison against Python Decimal passed 500 synthetic quotations; this
is development verification, not a new runtime or Windows dependency. TypeScript,
ESLint, source/config/test formatting and git diff --check pass.
No new dependency, database operation, real customer record or external service.

Not executed here: Windows commands, quotation RLS/database/browser integration
or a production build of a connected quotation module. Existing UI is unchanged.
Next: protected draft schema/RPCs, numbering, audit and isolated database tests,
then builder/list/Lead Details integration. Sprint 19 remains unauthorized.