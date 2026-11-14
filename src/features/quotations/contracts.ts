import { z } from 'zod';
import { PRICING_POLICY_ID, quotationDraftSchema } from './schemas';

const money = z.string().regex(/^(0|[1-9][0-9]{0,15})\.[0-9]{2}$/);

export const quotationCalculationSchema = z.object({
  currency: z.literal('AED'),
  policy: z.object({
    id: z.literal(PRICING_POLICY_ID),
    priceBasis: z.literal('exclusive'),
    rounding: z.literal('half_up'),
    moneyScale: z.literal(2),
    quantityScale: z.literal(4),
    unitPriceScale: z.literal(6),
    percentageScale: z.literal(6),
    discountOrder: z.literal('line_then_overall_then_tax'),
    allocation: z.literal('largest_remainder_stable_item_id'),
  }),
  lines: z
    .array(
      z.object({
        id: z.uuid(),
        subtotal: money,
        lineDiscount: money,
        overallDiscount: money,
        net: money,
        taxTreatment: z.enum(['taxable', 'zero_rated', 'exempt']),
        taxRate: z.string().regex(/^(0|[1-9][0-9]{0,2})\.[0-9]{6}$/),
        tax: money,
        total: money,
      }),
    )
    .max(200),
  totals: z.object({
    subtotal: money,
    lineDiscount: money,
    netSubtotal: money,
    overallDiscount: money,
    discount: money,
    net: money,
    tax: money,
    grandTotal: money,
  }),
});

const shape = quotationDraftSchema.shape;

export const quotationDocumentSchema = z
  .object({
    title: shape.title,
    quotationDate: shape.quotationDate,
    validUntil: shape.validUntil,
    companyVatNumber: shape.companyVatNumber,
    clientNotes: shape.clientNotes,
    internalNotes: shape.internalNotes,
    terms: shape.terms,
    paymentTerms: shape.paymentTerms,
    sections: shape.sections,
    pricing: shape.pricing,
  })
  .strict();

const identity = {
  id: z.uuid(),
  number: z.string().regex(/^AFAQ-Q-[0-9]{4}-[0-9]{6,12}$/),
  revision: z.number().int().min(1).max(2147483647),
  status: z.literal('draft'),
  version: z.number().int().min(1).max(2147483647),
  calculation: quotationCalculationSchema,
};

export const quotationSavedSchema = z
  .object({
    ...identity,
    replayed: z.boolean(),
  })
  .strict();

export const quotationRecordSchema = z
  .object({
    ...identity,
    leadId: z.uuid(),
    createdBy: z.uuid(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedBy: z.uuid(),
    updatedAt: z.iso.datetime({ offset: true }),
    customer: z
      .object({
        leadReference: z.string().regex(/^[0-9]+$/),
        customerName: z.string().max(160),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        propertyType: z.string().nullable(),
        location: z.string().nullable(),
      })
      .strict(),
    document: quotationDocumentSchema,
  })
  .strict();

export const quotationReadSchema = z.object({ id: z.uuid() }).strict();

export type QuotationSaved = z.infer<typeof quotationSavedSchema>;
export type QuotationRecord = z.infer<typeof quotationRecordSchema>;