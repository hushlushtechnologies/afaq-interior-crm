import { expect, test } from '@playwright/test';
import { calculateQuotation } from '../../src/features/quotations/pricing';
import {
  PRICING_POLICY_ID,
  pricingInputSchema,
  quotationDraftSchema,
  type PricingInput,
} from '../../src/features/quotations/schemas';
import { parseUnsignedDecimal } from '../../src/features/quotations/decimal';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
type Item = PricingInput['items'][number];
function item(value = 1, overrides: Partial<Item> = {}): Item {
  return {
    id: id(value),
    sectionId: null,
    description: 'Synthetic interior work',
    unit: 'm²',
    quantity: '1',
    unitPrice: '100',
    discount: { mode: 'none' },
    tax: { treatment: 'exempt' },
    ...overrides,
  };
}
function pricing(
  items: Item[] = [item()],
  overallDiscount: PricingInput['overallDiscount'] = { mode: 'none' },
): PricingInput {
  return { policyId: PRICING_POLICY_ID, currency: 'AED', items, overallDiscount };
}
function draft() {
  return {
    requestId: id(90),
    quotationId: null,
    expectedVersion: null,
    leadId: id(91),
    title: 'Synthetic quotation',
    quotationDate: '2026-11-13',
    validUntil: null,
    companyVatNumber: null,
    clientNotes: null,
    internalNotes: null,
    terms: null,
    paymentTerms: null,
    sections: [],
    pricing: pricing(),
  };
}

test('line discount, overall discount and explicit VAT follow the versioned order', () => {
  const result = calculateQuotation(
    pricing(
      [
        item(1, {
          discount: { mode: 'fixed', amount: '10' },
          tax: { treatment: 'taxable', rate: '5' },
        }),
      ],
      { mode: 'percent', rate: '10' },
    ),
  );
  expect(result.totals).toEqual({
    subtotal: '100.00',
    lineDiscount: '10.00',
    netSubtotal: '90.00',
    overallDiscount: '9.00',
    discount: '19.00',
    net: '81.00',
    tax: '4.05',
    grandTotal: '85.05',
  });
  expect(result.policy.id).toBe(PRICING_POLICY_ID);
});

test('quantity and six-place prices round half-up after multiplication', () => {
  expect(
    calculateQuotation(pricing([item(1, { quantity: '1.5', unitPrice: '19.995000' })])).totals
      .grandTotal,
  ).toBe('29.99');
  expect(
    calculateQuotation(pricing([item(1, { quantity: '0.1', unitPrice: '0.05' })])).totals
      .grandTotal,
  ).toBe('0.01');
});

test('decimal additions do not drift', () => {
  expect(
    calculateQuotation(pricing([item(1, { unitPrice: '0.1' }), item(2, { unitPrice: '0.2' })]))
      .totals.grandTotal,
  ).toBe('0.30');
});

test('mixed taxable, zero-rated and exempt lines keep distinct treatments', () => {
  const result = calculateQuotation(
    pricing(
      [
        item(1, { tax: { treatment: 'taxable', rate: '5' } }),
        item(2, { tax: { treatment: 'zero_rated' } }),
        item(3),
      ],
      { mode: 'percent', rate: '10' },
    ),
  );
  expect(result.totals.net).toBe('270.00');
  expect(result.totals.tax).toBe('4.50');
  expect(result.totals.grandTotal).toBe('274.50');
  expect(result.lines.map((line) => line.taxTreatment)).toEqual([
    'taxable',
    'zero_rated',
    'exempt',
  ]);
});

test('VAT is rounded per line, rather than once on the quotation sum', () => {
  const result = calculateQuotation(
    pricing(
      [1, 2, 3].map((value) =>
        item(value, {
          unitPrice: '0.10',
          tax: { treatment: 'taxable', rate: '5' },
        }),
      ),
    ),
  );
  expect(result.totals.tax).toBe('0.03');
  expect(result.totals.grandTotal).toBe('0.33');
});

test('discount remainder allocation uses fractional remainders', () => {
  const result = calculateQuotation(
    pricing(
      [item(1, { unitPrice: '1' }), item(2, { unitPrice: '2' }), item(3, { unitPrice: '3' })],
      { mode: 'fixed', amount: '0.05' },
    ),
  );
  expect(result.lines.map((line) => line.overallDiscount)).toEqual(['0.01', '0.02', '0.02']);
  expect(result.totals.grandTotal).toBe('5.95');
});

test('item reordering does not change allocation ties or financial totals', () => {
  const items = [
    item(1, { unitPrice: '0.10', tax: { treatment: 'taxable', rate: '5' } }),
    item(2, { unitPrice: '0.10' }),
    item(3, { unitPrice: '0.10' }),
  ];
  const first = calculateQuotation(pricing(items, { mode: 'fixed', amount: '0.01' }));
  const second = calculateQuotation(
    pricing([...items].reverse(), { mode: 'fixed', amount: '0.01' }),
  );
  expect(first.totals).toEqual(second.totals);
  expect(first.lines).toEqual([...second.lines].reverse());
  expect(first.totals.grandTotal).toBe('0.29');
});

test('100 percent discount leaves zero base and zero VAT', () => {
  const result = calculateQuotation(
    pricing([item(1, { tax: { treatment: 'taxable', rate: '17.5' } })], {
      mode: 'percent',
      rate: '100',
    }),
  );
  expect(result.totals.grandTotal).toBe('0.00');
  expect(result.totals.tax).toBe('0.00');
});

test('empty drafts, zero-price work and zero-base lines are handled safely', () => {
  expect(calculateQuotation(pricing([])).totals.grandTotal).toBe('0.00');
  const result = calculateQuotation(
    pricing([item(1, { unitPrice: '0' }), item(2, { unitPrice: '1' })], {
      mode: 'fixed',
      amount: '0.01',
    }),
  );
  expect(result.lines[0].overallDiscount).toBe('0.00');
  expect(result.totals.grandTotal).toBe('0.99');
});

test('large valid totals retain cents beyond the JavaScript safe integer range', () => {
  const result = calculateQuotation(
    pricing([
      item(1, { quantity: '10000000', unitPrice: '900719925.474099' }),
      item(2, { unitPrice: '0.01' }),
    ]),
  );
  expect(result.totals.grandTotal).toBe('9007199254740990.01');
});

test('overflow in a line, quotation subtotal or tax-inclusive total is rejected', () => {
  expect(() =>
    calculateQuotation(
      pricing([
        item(1, {
          quantity: '99999999999999.9999',
          unitPrice: '999999999999.999999',
        }),
      ]),
    ),
  ).toThrow('money range');
  const large = item(1, { quantity: '10000000', unitPrice: '900719925.474099' });
  expect(() => calculateQuotation(pricing([large, { ...large, id: id(2) }]))).toThrow(
    'money range',
  );
  expect(() =>
    calculateQuotation(pricing([{ ...large, tax: { treatment: 'taxable', rate: '100' } }])),
  ).toThrow('money range');
});

test('fixed discounts cannot exceed their applicable base', () => {
  expect(() =>
    calculateQuotation(pricing([item(1, { discount: { mode: 'fixed', amount: '100.01' } })])),
  ).toThrow('discount');
  expect(() =>
    calculateQuotation(
      pricing([item(1, { discount: { mode: 'fixed', amount: '90' } })], {
        mode: 'fixed',
        amount: '10.01',
      }),
    ),
  ).toThrow('discount');
  expect(() => calculateQuotation(pricing([], { mode: 'fixed', amount: '0.01' }))).toThrow(
    'discount',
  );
});

test('negative, zero quantity, overprecision, numeric and over-100 percentage inputs fail', () => {
  for (const patch of [
    { quantity: '0' },
    { quantity: '-1' },
    { quantity: '1.00001' },
    { unitPrice: '-1' },
    { unitPrice: '1.0000001' },
    { unitPrice: 1 },
    { discount: { mode: 'percent', rate: '100.000001' } },
    { discount: { mode: 'fixed', amount: '0.001' } },
  ])
    expect(
      pricingInputSchema.safeParse({ ...pricing(), items: [{ ...item(), ...patch }] }).success,
    ).toBe(false);
});

test('tax is explicit; malformed and contradictory tax requests fail without throwing from safeParse', () => {
  for (const tax of [
    undefined,
    { treatment: 'taxable', rate: '0' },
    { treatment: 'taxable', rate: 'bad' },
    { treatment: 'taxable', rate: '101' },
    { treatment: 'exempt', rate: '5' },
  ])
    expect(
      pricingInputSchema.safeParse({ ...pricing(), items: [{ ...item(), tax }] }).success,
    ).toBe(false);
});

test('the entered VAT rate changes totals without a hardcoded standard rate', () => {
  expect(
    calculateQuotation(pricing([item(1, { tax: { treatment: 'taxable', rate: '7.25' } })])).totals
      .grandTotal,
  ).toBe('107.25');
});

test('duplicate item identities, unsupported policy/currency and submitted totals fail', () => {
  expect(pricingInputSchema.safeParse(pricing([item(), item()])).success).toBe(false);
  const canonical = item(1, { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  expect(
    pricingInputSchema.safeParse(
      pricing([canonical, { ...canonical, id: canonical.id.toUpperCase() }]),
    ).success,
  ).toBe(false);
  for (const patch of [{ policyId: 'custom-formula' }, { currency: 'USD' }, { grandTotal: '1' }])
    expect(pricingInputSchema.safeParse({ ...pricing(), ...patch }).success).toBe(false);
  expect(
    pricingInputSchema.safeParse({ ...pricing(), items: [{ ...item(), total: '1' }] }).success,
  ).toBe(false);
});

test('custom unit labels remain text and inputs are not mutated or returned as bigint', () => {
  const input = pricing([item(1, { unit: ' custom room / point ' })]);
  const before = JSON.stringify(input);
  expect(pricingInputSchema.parse(input).items[0].unit).toBe('custom room / point');
  const result = calculateQuotation(input);
  expect(JSON.stringify(input)).toBe(before);
  expect(() => JSON.stringify(result)).not.toThrow();
});

test('resource limits are bounded', () => {
  expect(
    pricingInputSchema.safeParse(
      pricing(Array.from({ length: 201 }, (_, index) => item(index + 1))),
    ).success,
  ).toBe(false);
});

test('manual VAT text retains leading zeros and blank values become null', () => {
  expect(
    quotationDraftSchema.parse({ ...draft(), companyVatNumber: ' 000000000000001 ' })
      .companyVatNumber,
  ).toBe('000000000000001');
  expect(
    quotationDraftSchema.parse({ ...draft(), companyVatNumber: ' ' }).companyVatNumber,
  ).toBeNull();
});

test('draft dates and create/update version pairs are validated', () => {
  for (const patch of [
    { quotationDate: '2026-02-30' },
    { quotationDate: '0000-01-01' },
    { validUntil: '2026-11-12' },
    { quotationId: id(80) },
    { expectedVersion: 1 },
  ])
    expect(quotationDraftSchema.safeParse({ ...draft(), ...patch }).success).toBe(false);
  expect(
    quotationDraftSchema.safeParse({ ...draft(), quotationId: id(80), expectedVersion: 1 }).success,
  ).toBe(true);
});

test('sections must be unique and item links must reference this draft section list', () => {
  const section = { id: id(70), name: 'Living area', roomId: null };
  expect(quotationDraftSchema.safeParse({ ...draft(), sections: [section, section] }).success).toBe(
    false,
  );
  expect(
    quotationDraftSchema.safeParse({
      ...draft(),
      pricing: pricing([item(1, { sectionId: id(70) })]),
    }).success,
  ).toBe(false);
  expect(
    quotationDraftSchema.safeParse({
      ...draft(),
      sections: [section],
      pricing: pricing([item(1, { sectionId: id(70) })]),
    }).success,
  ).toBe(true);
});

test('draft requests cannot supply creator, approval or source-lead snapshots', () => {
  for (const patch of [
    { createdBy: id(80) },
    { status: 'approved' },
    { customerName: 'Forged source snapshot' },
  ])
    expect(quotationDraftSchema.safeParse({ ...draft(), ...patch }).success).toBe(false);
});

test('bounded combinations reconcile discounts, line totals and quotation totals exactly', () => {
  for (let sample = 0; sample < 100; sample++) {
    const input = pricing(
      Array.from({ length: 5 }, (_, index) =>
        item(index + 1, {
          unitPrice: String((sample + 1) * (index + 1)),
          discount: { mode: 'percent', rate: String(sample % 101) },
          tax: index % 2 ? { treatment: 'exempt' } : { treatment: 'taxable', rate: '5.125' },
        }),
      ),
      { mode: 'percent', rate: String((sample * 7) % 101) },
    );
    const result = calculateQuotation(input);
    const minor = (value: string) => parseUnsignedDecimal(value, 2);
    const total = (values: string[]) =>
      values.reduce((sum, value) => sum + minor(value), BigInt(0));
    expect(total(result.lines.map((line) => line.total))).toBe(minor(result.totals.grandTotal));
    expect(total(result.lines.map((line) => line.overallDiscount))).toBe(
      minor(result.totals.overallDiscount),
    );
    expect(minor(result.totals.net) + minor(result.totals.tax)).toBe(
      minor(result.totals.grandTotal),
    );
  }
});