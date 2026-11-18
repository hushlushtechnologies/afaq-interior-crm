import { quotationCalculationSchema, quotationRecordSchema } from './contracts';
import { quotationSnapshotSchema } from './history-contracts';
import { calculateQuotation } from './pricing';

export class DraftPdfModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftPdfModelError';
  }
}

/** Pure data projection. Call only after server-side resource authorization. */
export function createDraftQuotationPdfModel(recordInput: unknown, snapshotInput: unknown) {
  const record = quotationRecordSchema.safeParse(recordInput);
  const snapshot = quotationSnapshotSchema.safeParse(snapshotInput);

  if (!record.success || !snapshot.success)
    throw new DraftPdfModelError('The saved quotation data could not be verified.');

  const quote = record.data;
  const saved = snapshot.data;

  if (quote.id !== saved.quotationId)
    throw new DraftPdfModelError('The saved version belongs to a different quotation.');

  let recalculated;

  try {
    recalculated = quotationCalculationSchema.parse(calculateQuotation(saved.document.pricing));
  } catch {
    throw new DraftPdfModelError('The saved pricing could not be verified.');
  }

  if (JSON.stringify(recalculated) !== JSON.stringify(saved.calculation))
    throw new DraftPdfModelError('The saved financial snapshot does not match its pricing.');

  const sections = new Map(saved.document.sections.map((section) => [section.id, section.name]));

  if (sections.size !== saved.document.sections.length)
    throw new DraftPdfModelError('Saved quotation section identities must be unique.');

  if (
    saved.document.validUntil !== null &&
    saved.document.validUntil < saved.document.quotationDate
  )
    throw new DraftPdfModelError('The saved quotation validity dates are inconsistent.');

  const lines = saved.document.pricing.items.map((item, index) => {
    if (item.sectionId !== null && !sections.has(item.sectionId))
      throw new DraftPdfModelError('A saved item refers to an unavailable quotation section.');

    const amount = saved.calculation.lines[index];

    return {
      id: item.id,
      sectionId: item.sectionId,
      sectionName: item.sectionId === null ? null : sections.get(item.sectionId)!,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discount: { ...item.discount },
      taxTreatment: amount.taxTreatment,
      taxRate: amount.taxRate,
      subtotal: amount.subtotal,
      lineDiscount: amount.lineDiscount,
      overallDiscount: amount.overallDiscount,
      net: amount.net,
      tax: amount.tax,
      total: amount.total,
    };
  });

  // Explicit allowlist: never spread a document, record or snapshot into PDF data.
  return {
    templateVersion: 's19-internal-draft-v1' as const,
    documentKind: 'internal_draft' as const,
    statusLabel: 'DRAFT — NOT APPROVED FOR CLIENT DELIVERY' as const,
    quotation: {
      id: quote.id,
      number: quote.number,
      revision: saved.revision,
      savedVersion: saved.version,
      savedAt: saved.occurredAt,
      title: saved.document.title,
      quotationDate: saved.document.quotationDate,
      validUntil: saved.document.validUntil,
      currency: saved.calculation.currency,
    },
    customer: {
      leadReference: quote.customer.leadReference,
      name: quote.customer.customerName,
      email: quote.customer.email,
      phone: quote.customer.phone,
      propertyType: quote.customer.propertyType,
      location: quote.customer.location,
    },
    companyVatNumber: saved.document.companyVatNumber,
    sections: saved.document.sections.map((section) => ({
      id: section.id,
      name: section.name,
    })),
    lines,
    overallDiscount: { ...saved.document.pricing.overallDiscount },
    totals: { ...saved.calculation.totals },
    clientNotes: saved.document.clientNotes,
    terms: saved.document.terms,
    paymentTerms: saved.document.paymentTerms,
  };
}

export type DraftQuotationPdfModel = ReturnType<typeof createDraftQuotationPdfModel>;