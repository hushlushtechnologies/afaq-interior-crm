import { z } from 'zod';
import { salesTimestampSchema } from '@/features/follow-ups/schemas';

export const reminderQuerySchema = z
  .object({ page: z.number().int().min(0).max(100000).default(0) })
  .strict();

export const reminderReadInputSchema = z.object({ id: z.uuid() }).strict();

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const reminderPageSchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.uuid(),
        lead_id: z.uuid(),
        follow_up_id: z.uuid(),
        due_at: salesTimestampSchema,
        created_at: salesTimestampSchema,
        read_at: salesTimestampSchema.nullable(),
        title: z.literal('Follow-up due'),
      }),
    )
    .max(20),
  total: count,
  unread: count,
  page: count,
  pageSize: z.literal(20),
});

export const reminderReadSchema = z.object({
  id: z.uuid(),
  readAt: salesTimestampSchema,
});

export type ReminderPage = z.infer<typeof reminderPageSchema>;
export type ReminderRead = z.infer<typeof reminderReadSchema>;
