import { createDraftQuotationPdfModel } from '../../src/features/quotations/pdf-model';
import { calculateQuotation } from '../../src/features/quotations/pricing';
import { PRICING_POLICY_ID } from '../../src/features/quotations/schemas';

export const pdfFixtureId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Synthetic only; no database, account, password or customer fixture is used. */
export function draftPdfFixture(count = 2, description = 'Synthetic interior work') {
  const document = {
    title: 'Synthetic interior quotation',
    quotationDate: '2026-11-16',
    validUntil: '2026-12-16',
    companyVatNumber: '001234567890123',
    clientNotes: 'Synthetic client scope for internal review.',
    internalNotes: 'INTERNAL_PDF_RENDER_SENTINEL_93',
    terms: 'Synthetic saved terms. Review required.',
    paymentTerms: 'Synthetic payment terms.',
    sections: [{ id: pdfFixtureId(90), name: 'Living room', roomId: null }],
    pricing: {
      policyId: PRICING_POLICY_ID,
      currency: 'AED',
      items: Array.from({ length: count }, (_, index) => ({
        id: pdfFixtureId(index + 100),
        sectionId: pdfFixtureId(90),
        description: `${description} ${index + 1}`,
        quantity: '1.5',
        unit: 'm²',
        unitPrice: '100.123456',
        discount: { mode: 'percent', rate: '10' },
        tax: { treatment: 'taxable', rate: '5' },
      })),
      overallDiscount: { mode: 'percent', rate: '5' },
    },
  };
  const calculation = calculateQuotation(document.pricing);
  const savedAt = '2026-11-16T08:00:00Z';
  const record = {
    id: pdfFixtureId(1),
    number: 'AFAQ-Q-2026-000001',
    revision: 2,
    version: 3,
    status: 'draft',
    leadId: pdfFixtureId(3),
    createdBy: pdfFixtureId(2),
    createdAt: savedAt,
    updatedBy: pdfFixtureId(2),
    updatedAt: savedAt,
    document,
    calculation,
    customer: {
      leadReference: '23',
      customerName: 'Synthetic customer',
      email: 'fixture@example.test',
      phone: null,
      propertyType: 'Synthetic villa',
      location: 'Synthetic project location',
    },
  };
  const snapshot = {
    quotationId: record.id,
    revision: 2,
    version: 3,
    actorId: pdfFixtureId(2),
    occurredAt: savedAt,
    document,
    calculation,
  };
  return createDraftQuotationPdfModel(record, snapshot);
}