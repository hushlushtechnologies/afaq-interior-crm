import { z } from 'zod';
import { leadFieldsSchema } from '@/features/leads/schemas';
import { importPreviewInputSchema } from './preview';

export const importUploadSchema = importPreviewInputSchema.extend({
  requestId: z.uuid(),
  filename: z.string().min(5).max(180),
});
export const importPageInputSchema = z
  .object({ batchId: z.uuid(), page: z.number().int().min(0).max(10000) })
  .strict();
export const importErrorFieldSchema = z.enum([
  'row',
  'customer_name',
  'email',
  'phone',
  'alternate_phone',
  'property_type',
  'location',
  'budget',
  'expected_start_on',
  'inquiry_on',
  'follow_up_on',
  'description',
  'initial_note',
  'priority',
]);
const count = z.number().int().min(0).max(500);
const timestamp = z.iso.datetime({ offset: true });
export const importBatchSchema = z
  .object({
    id: z.uuid(),
    filename: z.string().min(5).max(180),
    sourceCode: leadFieldsSchema.shape.source_code,
    assignedUserId: z.uuid().nullable(),
    createdAt: timestamp,
    confirmationEnabled: z.literal(true),
    version: z.number().int().positive(),
    status: z.enum(['staged', 'completed']),
    completedAt: timestamp.nullable(),
    counts: z
      .object({
        total: count,
        ready: count,
        invalid: count,
        review: count,
        applied: count,
        skipped: count,
      })
      .refine(
        (c) => c.total >= 1 && c.total === c.ready + c.invalid + c.review + c.applied + c.skipped,
      ),
  })
  .refine((b) =>
    b.status === 'completed'
      ? b.completedAt !== null && b.counts.ready + b.counts.invalid + b.counts.review === 0
      : b.completedAt === null && b.counts.applied + b.counts.skipped === 0,
  );
export const importStageResultSchema = z.object({
  batch: importBatchSchema,
  replayed: z.boolean(),
});
export const importConfirmInputSchema = z
  .object({
    requestId: z.uuid(),
    batchId: z.uuid(),
    version: z.number().int().positive(),
    skips: z
      .array(z.number().int().min(2).max(1048576))
      .max(500)
      .refine((rows) => new Set(rows).size === rows.length),
  })
  .strict();
export const importConfirmResultSchema = z.object({
  batch: importBatchSchema,
  applied: count,
  skipped: count,
  requiresReview: z.boolean(),
  replayed: z.boolean(),
});
const row = z
  .object({
    row_number: z.number().int().min(2).max(1048576),
    data: leadFieldsSchema.nullable(),
    errors: z.array(importErrorFieldSchema).max(20),
    status: z.enum(['ready', 'invalid', 'review', 'applied', 'skipped']),
    duplicate_rows: z.array(z.number().int().min(2).max(1048576)).max(499),
    database_match: z.boolean(),
    resulting_lead_id: z.uuid().nullable(),
    redacted: z.boolean(),
  })
  .refine((r) => {
    if (r.redacted)
      return r.status === 'applied' && r.data === null && r.resulting_lead_id === null;
    if (r.status === 'applied')
      return r.data !== null && r.resulting_lead_id !== null && !r.errors.length;
    if (r.resulting_lead_id !== null) return false;
    if (r.status === 'skipped') return true;
    if (r.status === 'invalid') return r.data === null && r.errors.length > 0;
    return (
      r.data !== null &&
      !r.errors.length &&
      (r.status === 'review') === (r.database_match || r.duplicate_rows.length > 0)
    );
  });
export const importPageSchema = z.object({
  batch: importBatchSchema,
  page: z.number().int().min(0).max(10000),
  pageSize: z.literal(20),
  rows: z.array(row).max(20),
  events: z
    .array(
      z.object({
        id: z.number().int().positive(),
        actor_id: z.uuid(),
        action: z.enum(['staged', 'duplicates_detected', 'confirmed']),
        detail: z.record(z.string(), z.unknown()),
        occurred_at: timestamp,
      }),
    )
    .max(50),
});
export type ImportStageResult = z.infer<typeof importStageResultSchema>;
export type ImportPage = z.infer<typeof importPageSchema>;
