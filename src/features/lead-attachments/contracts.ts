import { z } from 'zod';
import { attachmentMimeSchema } from './schemas';

export const attachmentPageSchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.uuid(),
        filename: z.string(),
        mime: attachmentMimeSchema,
        bytes: z.number().int().positive(),
        state: z.enum(['ready', 'removed']),
        actor_id: z.uuid(),
        created_at: z.iso.datetime({ offset: true }),
        removed_by: z.uuid().nullable(),
        removed_at: z.iso.datetime({ offset: true }).nullable(),
        version: z.number().int().positive(),
      }),
    )
    .max(20),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.literal(20),
});

export type AttachmentPage = z.infer<typeof attachmentPageSchema>;