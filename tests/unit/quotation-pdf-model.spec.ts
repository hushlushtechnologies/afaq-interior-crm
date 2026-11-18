import { expect, test } from '@playwright/test';
import { createDraftQuotationPdfModel } from '../../src/features/quotations/pdf-model';
import {
  quotationCalculationSchema,
  quotationRecordSchema,
} from '../../src/features/quotations/contracts';
import { quotationSnapshotSchema } from '../../src/features/quotations/history-contracts';
import { calculateQuotation } from '../../src/features/quotations/pricing';
import { PRICING_POLICY_ID } from '../../src/features/quotations/schemas';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function fixture() {
  const document = {
    title: 'Selected saved draft',
    quotationDate: '2026-11-16',
    validUntil: null,
    companyVatNumber: '001234567890123',
    clientNotes: 'Client scope note',
    internalNotes: 'PRIVATE_INTERNAL_NOTE_83',
    terms: 'Saved terms',
    paymentTerms: 'Saved payment terms',
    sections: [],
    pricing: {
      policyId: PRICING_POLICY_ID,
      currency: 'AED',
      items: [
        {
          id: id(10),
          sectionId: null,
          description: 'Synthetic work',
          quantity: '1',
          unit: 'm²',
          unitPrice: '100',
          discount: { mode: 'none' },
          tax: { treatment: 'taxable', rate: '5' },
        },
      ],
      overallDiscount: { mode: 'none' },
    },
  };

  const calculation = calculateQuotation(document.pricing);

  const snapshot = quotationSnapshotSchema.parse({
    quotationId: id(1),
    revision: 1,
    version: 1,
    actorId: id(2),
    occurredAt: '2026-11-16T08:00:00Z',
    document,
    calculation,
  });

  const record = quotationRecordSchema.parse({
    id: id(1),
    number: 'AFAQ-Q-2026-000001',
    revision: 1,
    version: 1,
    status: 'draft',
    leadId: id(3),
    createdBy: id(2),
    createdAt: snapshot.occurredAt,
    updatedBy: id(2),
    updatedAt: snapshot.occurredAt,
    document,
    calculation,
    customer: {
      leadReference: '23',
      customerName: 'Synthetic customer',
      email: null,
      phone: null,
      propertyType: null,
      location: null,
    },
  });

  return { record, snapshot };
}

test('projects explicit draft data and excludes internal notes and actor identities', () => {
  const { record, snapshot } = fixture();
  const model = createDraftQuotationPdfModel(record, snapshot);

  expect(model.documentKind).toBe('internal_draft');
  expect(model.statusLabel).toBe('DRAFT — NOT APPROVED FOR CLIENT DELIVERY');
  expect(model.totals.grandTotal).toBe('105.00');
  expect(model.clientNotes).toBe('Client scope note');
  expect(model.companyVatNumber).toBe('001234567890123');

  const serialized = JSON.stringify(model);

  expect(serialized).not.toContain('PRIVATE_INTERNAL_NOTE_83');
  expect(serialized).not.toContain('internalNotes');
  expect(serialized).not.toContain(id(2));
  expect(serialized).not.toContain(id(3));
});

test('uses the requested saved version rather than current draft content', () => {
  const { record, snapshot } = fixture();

  record.revision = 3;
  record.version = 7;
  record.document.title = 'Newer unsent scope';
  record.document.pricing.items[0].unitPrice = '900';
  record.calculation = quotationCalculationSchema.parse(calculateQuotation(record.document.pricing));

  snapshot.revision = 2;
  snapshot.version = 4;

  const model = createDraftQuotationPdfModel(record, snapshot);

  expect(model.quotation.revision).toBe(2);
  expect(model.quotation.savedVersion).toBe(4);
  expect(model.quotation.title).toBe('Selected saved draft');
  expect(model.quotation.savedAt).toBe(snapshot.occurredAt);
  expect(model.lines[0].unitPrice).toBe('100');
  expect(model.totals.grandTotal).toBe('105.00');
});

test('rejects mixing snapshots from different quotation identities', () => {
  const { record, snapshot } = fixture();

  expect(() =>
    createDraftQuotationPdfModel(record, {
      ...snapshot,
      quotationId: id(9),
    }),
  ).toThrow('different quotation');
});

test('rejects mismatched saved totals and line calculations', () => {
  const { record, snapshot } = fixture();

  const totals = structuredClone(snapshot);
  totals.calculation.totals.grandTotal = '104.99';

  expect(() => createDraftQuotationPdfModel(record, totals)).toThrow('financial snapshot');

  const lines = structuredClone(snapshot);
  lines.calculation.lines[0].id = id(99);

  expect(() => createDraftQuotationPdfModel(record, lines)).toThrow('financial snapshot');
});

test('large financial values retain exact decimal strings', () => {
  const { record, snapshot } = fixture();

  snapshot.document.pricing.items[0].quantity = '90071992547.4099';
  snapshot.document.pricing.items[0].unitPrice = '100000';
  snapshot.document.pricing.items[0].tax = { treatment: 'exempt' };
  snapshot.calculation = quotationCalculationSchema.parse(
    calculateQuotation(snapshot.document.pricing),
  );

  const model = createDraftQuotationPdfModel(record, snapshot);

  expect(model.totals.grandTotal).toBe('9007199254740990.00');
  expect(model.lines[0].quantity).toBe('90071992547.4099');
});

test('preserves unknown values and Unicode without inventing company details', () => {
  const { record, snapshot } = fixture();

  record.customer.customerName = 'عميل تجريبي';
  snapshot.document.companyVatNumber = null;
  snapshot.document.clientNotes = null;

  const model = createDraftQuotationPdfModel(record, snapshot);

  expect(model.customer.name).toBe('عميل تجريبي');
  expect(model.customer.email).toBeNull();
  expect(model.customer.propertyType).toBeNull();
  expect(model.companyVatNumber).toBeNull();
  expect(model.clientNotes).toBeNull();
  expect(model).not.toHaveProperty('companyAddress');
});

test('retains line order and same-name sections while excluding room identities', () => {
  const { record, snapshot } = fixture();

  snapshot.document.sections = [
    { id: id(20), name: 'Room', roomId: id(30) },
    { id: id(21), name: 'Room', roomId: id(31) },
  ];

  snapshot.document.pricing.items[0].sectionId = id(20);

  const second = {
    ...structuredClone(snapshot.document.pricing.items[0]),
    id: id(11),
    sectionId: null,
  };

  snapshot.document.pricing.items.push(second);
  snapshot.calculation = quotationCalculationSchema.parse(
    calculateQuotation(snapshot.document.pricing),
  );

  const model = createDraftQuotationPdfModel(record, snapshot);

  expect(model.lines.map((line) => line.id)).toEqual([id(10), id(11)]);
  expect(model.lines.map((line) => line.sectionName)).toEqual(['Room', null]);
  expect(model.sections.map((section) => section.name)).toEqual(['Room', 'Room']);
  expect(JSON.stringify(model)).not.toContain(id(30));
});

test('rejects invalid section relationships, duplicate sections and validity dates', () => {
  const { record, snapshot } = fixture();

  const missing = structuredClone(snapshot);
  missing.document.pricing.items[0].sectionId = id(50);

  expect(() => createDraftQuotationPdfModel(record, missing)).toThrow(
    'unavailable quotation section',
  );

  const duplicate = structuredClone(snapshot);
  duplicate.document.sections = [
    { id: id(20), name: 'A', roomId: null },
    { id: id(20), name: 'B', roomId: null },
  ];

  expect(() => createDraftQuotationPdfModel(record, duplicate)).toThrow('must be unique');

  const dates = structuredClone(snapshot);
  dates.document.validUntil = '2026-11-15';

  expect(() => createDraftQuotationPdfModel(record, dates)).toThrow('validity dates');
});

test('does not mutate inputs or accept an approved state through the draft contract', () => {
  const { record, snapshot } = fixture();
  const original = JSON.stringify({ record, snapshot });

  const model = createDraftQuotationPdfModel(record, snapshot);
  model.customer.name = 'Changed projection';
  model.totals.grandTotal = '0.00';

  expect(JSON.stringify({ record, snapshot })).toBe(original);

  expect(() =>
    createDraftQuotationPdfModel(
      {
        ...record,
        status: 'approved',
      },
      snapshot,
    ),
  ).toThrow('could not be verified');
});