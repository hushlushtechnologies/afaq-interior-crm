import { z } from 'zod';

const base = { requestId: z.uuid(), leadId: z.uuid(), version: z.number().int().positive() };

const note = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => value || null)
  .nullable()
  .default(null);

export const pipelineCommandSchema = z.discriminatedUnion('command', [
  z
    .object({
      ...base,
      command: z.literal('move'),
      data: z
        .object({ stage: z.enum(['new', 'assigned', 'contacted', 'requirements', 'site-visit']) })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('lose'),
      data: z
        .object({
          reasonCode: z.string().regex(/^[a-z_]{1,40}$/),
          explanation: note,
          note,
        })
        .strict()
        .refine((value) => value.reasonCode !== 'other' || Boolean(value.explanation), {
          message: 'Explain the Other Lost reason.',
          path: ['explanation'],
        }),
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('reopen'),
      data: z.object({ reason: z.string().trim().min(1).max(2000) }).strict(),
    })
    .strict(),
]);

export type PipelineCommand = z.infer<typeof pipelineCommandSchema>;

export const pipelineDetailSchema = z.object({
  reasons: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      requires_explanation: z.boolean(),
      active: z.boolean(),
    }),
  ),
  losses: z.array(
    z.object({
      id: z.uuid(),
      lead_id: z.uuid(),
      actor_id: z.uuid(),
      reason_code: z.string(),
      explanation: z.string().nullable(),
      internal_note: z.string().nullable(),
      previous_stage: z.string(),
      occurred_at: z.string(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.number().int(),
      actor_id: z.uuid(),
      action: z.string(),
      occurred_at: z.string(),
      previous_stage: z.string().nullable(),
      new_stage: z.string().nullable(),
      reason: z.string().nullable(),
      loss_id: z.uuid().nullable(),
    }),
  ),
});

export type PipelineDetail = z.infer<typeof pipelineDetailSchema>;
