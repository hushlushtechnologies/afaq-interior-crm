import { expect, test } from '@playwright/test';
import { compareQuotationSnapshots } from '../../src/features/quotations/compare-snapshots';
import { quotationSnapshotSchema } from '../../src/features/quotations/history-contracts';
import { quotationCalculationSchema } from '../../src/features/quotations/contracts';
import { calculateQuotation } from '../../src/features/quotations/pricing';
import { PRICING_POLICY_ID, type PricingInput } from '../../src/features/quotations/schemas';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function item(n: number, price = '100'): PricingInput['items'][number] {
  return {
    id: id(n),
    sectionId: null,
    description: `Synthetic ${n}`,
    quantity: '1',
    unit: 'm²',
    unitPrice: price,
    discount: { mode: 'none' },
    tax: { treatment: 'exempt' },
  };
}

function snapshot(items = [item(1)]) {
  const pricing: PricingInput = {
    policyId: PRICING_POLICY_ID,
    currency: 'AED',
    items,
    overallDiscount: { mode: 'none' },
  };

  return quotationSnapshotSchema.parse({
    quotationId: id(99),
    revision: 1,
    version: 1,
    actorId: id(98),
    occurredAt: '2026-11-14T00:00:00Z',
    document: {
      title: 'Synthetic quote',
      quotationDate: '2026-11-14',
      validUntil: null,
      companyVatNumber: null,
      clientNotes: null,
      internalNotes: null,
      terms: null,
      paymentTerms: null,
      sections: [],
      pricing,
    },
    calculation: calculateQuotation(pricing),
  });
}

test('unchanged saved inputs have no differences and zero monetary changes', () => {
  const a = snapshot();
  const result = compareQuotationSnapshots(a, structuredClone(a));

  expect(result.changes).toEqual([]);
  expect(result.items).toEqual([]);
  expect(result.totals.every((row) => row.delta === '0.00')).toBe(true);
});

test('stable item IDs distinguish additions, removal, editing and reordering', () => {
  const a = snapshot([item(1), item(2), item(3)]);
  const b = snapshot([item(2, '120'), item(1), item(4)]);
  const result = compareQuotationSnapshots(a, b);

  expect(result.items.map((row) => [row.id, row.action])).toEqual([
    [id(1), 'Reordered'],
    [id(2), 'Changed and reordered'],
    [id(3), 'Removed'],
    [id(4), 'Added'],
  ]);
});

test('header, section and discount edits remain separate from item edits', () => {
  const a = snapshot();
  const b = structuredClone(a);

  b.document.title = 'Changed title';
  b.document.sections = [{ id: id(70), name: 'Room A', roomId: null }];
  b.document.pricing.overallDiscount = { mode: 'fixed', amount: '10' };
  b.calculation = quotationCalculationSchema.parse(calculateQuotation(b.document.pricing));

  expect(compareQuotationSnapshots(a, b).changes.map((row) => row.field)).toEqual([
    'title',
    'sections',
    'overallDiscount',
  ]);

  expect(compareQuotationSnapshots(a, b).items).toEqual([]);
});

test('large monetary differences retain signed cents and cannot compare unrelated quotes', () => {
  const large = { ...item(1, '100000'), quantity: '90071992547.4099' };
  const a = snapshot([large]);
  const b = snapshot([large, item(2, '0.01')]);

  expect(
    compareQuotationSnapshots(a, b).totals.find((row) => row.field === 'grandTotal')?.delta,
  ).toBe('+0.01');

  expect(
    compareQuotationSnapshots(b, a).totals.find((row) => row.field === 'grandTotal')?.delta,
  ).toBe('-0.01');

  expect(() => compareQuotationSnapshots(a, { ...b, quotationId: id(80) })).toThrow(
    'same quotation',
  );
});