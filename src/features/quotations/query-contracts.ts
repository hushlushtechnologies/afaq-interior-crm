import { z } from 'zod';
import { quotationRecordSchema } from './contracts';

export const quotationQuerySchema = z
  .object({
    page: z.number().int().min(0).max(10000).default(0),
    search: z.string().trim().max(100).default(''),
    sort: z
      .enum(['number', 'customer', 'amount', 'created', 'updated', 'owner'])
      .default('created'),
    direction: z.enum(['asc', 'desc']).default('desc'),
    owner: z.enum(['all', 'mine', 'unassigned']).default('all'),
    status: z.enum(['all', 'draft']).default('all'),
    leadId: z.uuid().nullable().default(null),
  })
  .strict();

export const quotationPageSchema = z
  .object({
    page: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    rows: z
      .array(
        z
          .object({
            id: z.uuid(),
            number: z.string(),
            leadId: z.uuid(),
            leadReference: z.string(),
            customerName: z.string(),
            title: z.string(),
            status: z.literal('draft'),
            amount: z.string().regex(/^(0|[1-9][0-9]{0,15})\.[0-9]{2}$/),
            ownerId: z.uuid().nullable(),
            ownerName: z.string().nullable(),
            createdAt: z.iso.datetime({ offset: true }),
            updatedAt: z.iso.datetime({ offset: true }),
            canReadLead: z.boolean(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const quotationContextQuerySchema = z
  .object({
    leadId: z.uuid().nullable(),
    quotationId: z.uuid().nullable(),
  })
  .strict()
  .refine((value) => value.leadId !== null || value.quotationId !== null);

export const quotationContextSchema = z
  .object({
    leadId: z.uuid(),
    customer: quotationRecordSchema.shape.customer,
    canReadLead: z.boolean(),
    canCreate: z.boolean(),
    canEdit: z.boolean(),
    ownerName: z.string().nullable(),
    rooms: z.array(z.object({ id: z.uuid(), name: z.string() })).max(200),
    requirements: z.string().nullable(),
    roomsTruncated: z.boolean(),
  })
  .strict();

export type QuotationQuery = z.infer<typeof quotationQuerySchema>;
export type QuotationPage = z.infer<typeof quotationPageSchema>;
export type QuotationContext = z.infer<typeof quotationContextSchema>;

export const quotationMoney = (value: string) => {
  const [whole, fraction] = value.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction} AED`;
};
