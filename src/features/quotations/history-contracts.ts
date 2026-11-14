import { z } from 'zod';
import { quotationCalculationSchema, quotationDocumentSchema } from './contracts';

const version = z.number().int().min(1).max(2147483647);

export const historyQuerySchema = z
  .object({ id: z.uuid(), page: z.number().int().min(0).max(10000) })
  .strict();

export const snapshotQuerySchema = z.object({ id: z.uuid(), version }).strict();

export const quotationHistorySchema = z
  .object({
    page: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    rows: z
      .array(
        z
          .object({
            revision: version,
            version,
            actorId: z.uuid(),
            occurredAt: z.iso.datetime({ offset: true }),
            revisionCreatedBy: z.uuid(),
            revisionCreatedAt: z.iso.datetime({ offset: true }),
            reason: z.string().nullable(),
            isCurrentRevision: z.boolean(),
            isLatestSave: z.boolean(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const quotationSnapshotSchema = z
  .object({
    quotationId: z.uuid(),
    revision: version,
    version,
    actorId: z.uuid(),
    occurredAt: z.iso.datetime({ offset: true }),
    document: quotationDocumentSchema,
    calculation: quotationCalculationSchema,
  })
  .strict();

export type QuotationHistoryPage = z.infer<typeof quotationHistorySchema>;
export type QuotationSnapshot = z.infer<typeof quotationSnapshotSchema>;