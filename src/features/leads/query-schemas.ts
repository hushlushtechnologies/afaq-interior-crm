import { z } from 'zod';
import { DEMO_STAGES } from '@/lib/demo/stages';
import { leadRowSchema } from './schemas';

export const pipelineStages = DEMO_STAGES.map((stage) => stage.id);

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });

export const pipelineQuerySchema = z
  .object({
    page: z.number().int().min(0).max(10000).default(0),
    pageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]).default(20),
    archived: z.boolean().default(false),
    search: z.string().trim().max(100).default(''),
    stage: z.enum(pipelineStages).nullable().default(null),
    source: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,39}$/)
      .nullable()
      .default(null),
    owner: z
      .union([z.uuid(), z.literal('unassigned')])
      .nullable()
      .default(null),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).nullable().default(null),
    from: date.nullable().default(null),
    to: date.nullable().default(null),
    sort: z
      .enum([
        'created_at',
        'customer_name',
        'reference',
        'budget',
        'inquiry_on',
        'follow_up_on',
        'priority',
        'source_code',
        'owner',
        'stage',
      ])
      .default('created_at'),
    direction: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'The start date must be on or before the end date.',
    path: ['from'],
  });

export type PipelineQuery = z.infer<typeof pipelineQuerySchema>;

export const pipelinePageSchema = z.object({
  rows: z.array(leadRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  stageCounts: z.partialRecord(z.enum(pipelineStages), z.number().int().nonnegative()),
  sources: z.array(z.object({ code: z.string(), name: z.string() })),
  owners: z.array(z.object({ id: z.uuid(), name: z.string() })),
});

export type PipelinePage = z.infer<typeof pipelinePageSchema>;
