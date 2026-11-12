import { z } from 'zod';
import { salesTimestampSchema } from '@/features/follow-ups/schemas';

export const timelineQuerySchema = z
  .object({
    leadId: z.uuid(),
    page: z.number().int().min(0).max(100000).default(0),
  })
  .strict();

export const timelinePageSchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.string().min(1),
        source: z.enum(['lead', 'detail', 'visit', 'follow_up', 'manual']),
        actor_id: z.uuid(),
        recorded_at: salesTimestampSchema,
        activity_at: salesTimestampSchema,
        title: z.string(),
        details: z.record(z.string(), z.unknown()),
      }),
    )
    .max(20),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  page: z.number().int().nonnegative(),
  pageSize: z.literal(20),
});

export type TimelinePage = z.infer<typeof timelinePageSchema>;
