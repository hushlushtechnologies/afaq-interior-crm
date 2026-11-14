import { z } from 'zod';

const counter = z.number().int().min(1).max(2147483647);

export const createQuotationRevisionSchema = z
  .object({
    requestId: z.uuid(),
    quotationId: z.uuid(),
    expectedVersion: counter,
    expectedRevision: counter,
    reason: z.string().trim().min(1, 'Enter a revision reason.').max(2000),
  })
  .strict();

export type CreateQuotationRevision = z.infer<typeof createQuotationRevisionSchema>;