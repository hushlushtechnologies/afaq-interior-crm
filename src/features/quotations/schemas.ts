import { z } from 'zod';
import { parseUnsignedDecimal } from './decimal';

export const PRICING_POLICY_ID = 's18-exclusive-discount-before-tax-half-up-v1';
const uuid = z.uuid().transform((value) => value.toLowerCase());

function decimal(integerDigits: number, scale: number, positive = false) {
  const pattern = new RegExp(`^(0|[1-9][0-9]{0,${integerDigits - 1}})(\\.[0-9]{1,${scale}})?$`);
  return z
    .string()
    .max(integerDigits + scale + 1)
    .refine((value) => {
      if (!pattern.test(value) || value.trim() !== value) return false;
      try {
        return !positive || parseUnsignedDecimal(value, scale) > BigInt(0);
      } catch {
        return false;
      }
    }, 'Enter a valid nonnegative decimal string within the supported precision.');
}

const money = decimal(16, 2);
const percentage = decimal(3, 6).refine((value) => {
  try {
    return parseUnsignedDecimal(value, 6) <= BigInt(100000000);
  } catch {
    return false;
  }
}, 'Percentage must be between 0 and 100.');

export const discountSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }).strict(),
  z.object({ mode: z.literal('fixed'), amount: money }).strict(),
  z.object({ mode: z.literal('percent'), rate: percentage }).strict(),
]);

const taxSchema = z.discriminatedUnion('treatment', [
  z
    .object({
      treatment: z.literal('taxable'),
      rate: percentage.refine((value) => {
        try {
          return parseUnsignedDecimal(value, 6) > BigInt(0);
        } catch {
          return false;
        }
      }, 'A taxable line requires a positive rate.'),
    })
    .strict(),
  z.object({ treatment: z.literal('zero_rated') }).strict(),
  z.object({ treatment: z.literal('exempt') }).strict(),
]);

export const quotationItemSchema = z
  .object({
    id: uuid,
    sectionId: uuid.nullable(),
    description: z.string().trim().min(1).max(2000),
    unit: z.string().trim().min(1).max(40),
    quantity: decimal(14, 4, true),
    unitPrice: decimal(12, 6),
    discount: discountSchema,
    tax: taxSchema,
  })
  .strict();

export const pricingInputSchema = z
  .object({
    policyId: z.literal(PRICING_POLICY_ID),
    currency: z.literal('AED'),
    items: z.array(quotationItemSchema).max(200),
    overallDiscount: discountSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      if (seen.has(item.id))
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'id'],
          message: 'Item IDs must be unique.',
        });
      seen.add(item.id);
    });
  });

const date = z
  .string()
  .length(10)
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    if (value.length !== 10 || value.startsWith('0000-')) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Enter a valid calendar date.');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();

export const quotationDraftSchema = z
  .object({
    requestId: uuid,
    quotationId: uuid.nullable(),
    expectedVersion: z.number().int().min(1).max(2147483647).nullable(),
    leadId: uuid,
    title: z.string().trim().min(2).max(160),
    quotationDate: date,
    validUntil: date.nullable(),
    companyVatNumber: optionalText(32),
    clientNotes: optionalText(4000),
    internalNotes: optionalText(4000),
    terms: optionalText(8000),
    paymentTerms: optionalText(4000),
    sections: z
      .array(
        z
          .object({
            id: uuid,
            name: z.string().trim().min(1).max(160),
            roomId: uuid.nullable(),
          })
          .strict(),
      )
      .max(50),
    pricing: pricingInputSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.quotationId === null) !== (value.expectedVersion === null))
      context.addIssue({
        code: 'custom',
        path: ['expectedVersion'],
        message: 'An update requires both quotation ID and version.',
      });
    if (value.validUntil !== null && value.validUntil < value.quotationDate)
      context.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'Validity cannot precede the quotation date.',
      });
    const sections = new Set<string>();
    value.sections.forEach((section, index) => {
      if (sections.has(section.id))
        context.addIssue({
          code: 'custom',
          path: ['sections', index, 'id'],
          message: 'Section IDs must be unique.',
        });
      sections.add(section.id);
    });
    value.pricing.items.forEach((item, index) => {
      if (item.sectionId !== null && !sections.has(item.sectionId))
        context.addIssue({
          code: 'custom',
          path: ['pricing', 'items', index, 'sectionId'],
          message: 'Select a section in this quotation.',
        });
    });
  });

export type Discount = z.infer<typeof discountSchema>;
export type PricingInput = z.infer<typeof pricingInputSchema>;
export type QuotationDraft = z.infer<typeof quotationDraftSchema>;
