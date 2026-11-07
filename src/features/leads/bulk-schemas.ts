import { z } from 'zod';

export const bulkAssignmentSchema = z
  .object({
    requestId: z.uuid(),
    owner: z.uuid().nullable(),
    rows: z
      .array(z.object({ id: z.uuid(), version: z.number().int().min(1).max(999999999) }).strict())
      .min(1)
      .max(50),
  })
  .strict()
  .refine(
    (value) => new Set(value.rows.map((row) => row.id.toLowerCase())).size === value.rows.length,
    'Select each lead only once.',
  );

export type BulkAssignment = z.infer<typeof bulkAssignmentSchema>;

export const bulkResultSchema = z.object({
  affected: z.number().int().min(1).max(50),
  changed: z.number().int().min(0).max(50),
  replayed: z.boolean(),
});

export type BulkResult = z.infer<typeof bulkResultSchema>;
