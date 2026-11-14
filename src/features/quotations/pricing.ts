import { formatUnsignedDecimal, parseUnsignedDecimal } from './decimal';
import { pricingInputSchema, PRICING_POLICY_ID, type Discount } from './schemas';

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const PERCENT_DENOMINATOR = BigInt(100000000);
const LINE_DENOMINATOR = BigInt(100000000);
const MAX_MONEY = BigInt('999999999999999999');

function halfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  return quotient + ((numerator % denominator) * TWO >= denominator ? ONE : ZERO);
}

function bounded(value: bigint): bigint {
  if (value < ZERO || value > MAX_MONEY)
    throw new RangeError('A quotation amount exceeds the supported nonnegative money range.');
  return value;
}

function discountAmount(discount: Discount, base: bigint): bigint {
  const amount =
    discount.mode === 'none'
      ? ZERO
      : discount.mode === 'fixed'
        ? parseUnsignedDecimal(discount.amount, 2)
        : halfUp(base * parseUnsignedDecimal(discount.rate, 6), PERCENT_DENOMINATOR);
  if (amount > base) throw new RangeError('A discount cannot exceed its remaining subtotal.');
  return bounded(amount);
}

const money = (value: bigint) => formatUnsignedDecimal(bounded(value), 2);
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, ZERO);

/** Pure preview/server calculation. Persistence must independently verify authority and inputs. */
export function calculateQuotation(input: unknown) {
  const parsed = pricingInputSchema.parse(input);
  const lines = parsed.items.map((item) => {
    const subtotal = bounded(
      halfUp(
        parseUnsignedDecimal(item.quantity, 4) * parseUnsignedDecimal(item.unitPrice, 6),
        LINE_DENOMINATOR,
      ),
    );
    const discount = discountAmount(item.discount, subtotal);
    return { item, subtotal, discount, net: subtotal - discount };
  });
  const subtotal = bounded(sum(lines.map((line) => line.subtotal)));
  const lineDiscountTotal = bounded(sum(lines.map((line) => line.discount)));
  const netSubtotal = bounded(sum(lines.map((line) => line.net)));
  const overallDiscount = discountAmount(parsed.overallDiscount, netSubtotal);
  const allocations = lines.map(() => ZERO);

  if (overallDiscount > ZERO) {
    const ranked = lines
      .map((line, index) => {
        const product = overallDiscount * line.net;
        allocations[index] = product / netSubtotal;
        return { index, id: line.item.id, remainder: product % netSubtotal };
      })
      .sort((a, b) =>
        a.remainder > b.remainder
          ? -1
          : a.remainder < b.remainder
            ? 1
            : a.id < b.id
              ? -1
              : a.id > b.id
                ? 1
                : 0,
      );
    let remaining = overallDiscount - sum(allocations);
    for (const entry of ranked) {
      if (remaining === ZERO) break;
      allocations[entry.index] += ONE;
      remaining -= ONE;
    }
    if (remaining !== ZERO) throw new Error('Discount allocation could not be reconciled.');
  }

  const calculated = lines.map((line, index) => {
    const allocated = allocations[index];
    const net = bounded(line.net - allocated);
    const rate =
      line.item.tax.treatment === 'taxable' ? parseUnsignedDecimal(line.item.tax.rate, 6) : ZERO;
    const tax = bounded(halfUp(net * rate, PERCENT_DENOMINATOR));
    return {
      id: line.item.id,
      subtotal: line.subtotal,
      discount: line.discount,
      allocated,
      net,
      rate,
      treatment: line.item.tax.treatment,
      tax,
      total: bounded(net + tax),
    };
  });
  const netTotal = bounded(sum(calculated.map((line) => line.net)));
  const taxTotal = bounded(sum(calculated.map((line) => line.tax)));
  const grandTotal = bounded(netTotal + taxTotal);
  if (
    netTotal !== netSubtotal - overallDiscount ||
    sum(calculated.map((line) => line.total)) !== grandTotal
  )
    throw new Error('Quotation totals could not be reconciled.');

  return {
    currency: parsed.currency,
    policy: {
      id: PRICING_POLICY_ID,
      priceBasis: 'exclusive' as const,
      rounding: 'half_up' as const,
      moneyScale: 2,
      quantityScale: 4,
      unitPriceScale: 6,
      percentageScale: 6,
      discountOrder: 'line_then_overall_then_tax' as const,
      allocation: 'largest_remainder_stable_item_id' as const,
    },
    lines: calculated.map((line) => ({
      id: line.id,
      subtotal: money(line.subtotal),
      lineDiscount: money(line.discount),
      overallDiscount: money(line.allocated),
      net: money(line.net),
      taxTreatment: line.treatment,
      taxRate: formatUnsignedDecimal(line.rate, 6),
      tax: money(line.tax),
      total: money(line.total),
    })),
    totals: {
      subtotal: money(subtotal),
      lineDiscount: money(lineDiscountTotal),
      netSubtotal: money(netSubtotal),
      overallDiscount: money(overallDiscount),
      discount: money(lineDiscountTotal + overallDiscount),
      net: money(netTotal),
      tax: money(taxTotal),
      grandTotal: money(grandTotal),
    },
  };
}

export type QuotationCalculation = ReturnType<typeof calculateQuotation>;
