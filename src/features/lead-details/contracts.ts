import { z } from 'zod';
import { internalNoteFieldsSchema, requirementFieldsSchema, roomFieldsSchema } from './schemas';

const identity = {
  lead_id: z.uuid(),
  id: z.uuid(),
  created_by: z.uuid(),
  created_at: z.string(),
  updated_by: z.uuid(),
  updated_at: z.string(),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  archived_at: z.string().nullable().optional(),
};
export const detailRecordSchema = z.discriminatedUnion('kind', [
  z
    .object({ ...identity, kind: z.literal('requirements'), data: requirementFieldsSchema })
    .strict(),
  z.object({ ...identity, kind: z.literal('room'), data: roomFieldsSchema }).strict(),
  z.object({ ...identity, kind: z.literal('note'), data: internalNoteFieldsSchema }).strict(),
]);
export const detailQuerySchema = z
  .object({
    leadId: z.uuid(),
    kind: z.enum(['requirements', 'room', 'note']),
    page: z.number().int().min(0).max(10000).default(0),
  })
  .strict();
export const detailPageSchema = z.object({
  rows: z.array(detailRecordSchema).max(20),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.literal(20),
  events: z
    .array(
      z.object({
        id: z.number().int().positive(),
        lead_id: z.uuid(),
        record_id: z.uuid(),
        actor_id: z.uuid(),
        action: z.enum(['created', 'updated', 'archived']),
        before_data: detailRecordSchema.nullable(),
        after_data: detailRecordSchema,
        occurred_at: z.string(),
      }),
    )
    .max(50),
});
export const detailSaveSchema = z.object({ record: detailRecordSchema, replayed: z.boolean() });
export type DetailRecord = z.infer<typeof detailRecordSchema>;
export type DetailQuery = z.infer<typeof detailQuerySchema>;
export type DetailPage = z.infer<typeof detailPageSchema>;
export type DetailSave = z.infer<typeof detailSaveSchema>;
