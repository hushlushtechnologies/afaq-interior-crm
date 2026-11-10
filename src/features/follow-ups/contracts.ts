import { z } from 'zod';
import { followUpFieldsSchema, followUpStatusSchema, salesTimestampSchema } from './schemas';

const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const meaningful = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/[\p{L}\p{N}]/u);

const row = followUpFieldsSchema.extend({
  id: z.uuid(),
  lead_id: z.uuid(),
  status: followUpStatusSchema,
  actual_at: salesTimestampSchema.nullable(),
  outcome: meaningful(4000).nullable(),
  cancellation_reason: meaningful(2000).nullable(),
  completed_activity_id: z.uuid().nullable(),
  finalized_by: z.uuid().nullable(),
  finalized_at: salesTimestampSchema.nullable(),
  created_by: z.uuid(),
  created_at: salesTimestampSchema,
  updated_by: z.uuid(),
  updated_at: salesTimestampSchema,
  version,
});

function statusEvidence(value: z.infer<typeof row>) {
  const final = value.finalized_by !== null && value.finalized_at !== null;

  if (value.status === 'completed')
    return (
      final &&
      value.actual_at !== null &&
      value.outcome !== null &&
      value.completed_activity_id !== null &&
      value.cancellation_reason === null
    );

  if (value.status === 'cancelled')
    return (
      final &&
      value.cancellation_reason !== null &&
      value.actual_at === null &&
      value.outcome === null &&
      value.completed_activity_id === null
    );

  return (
    value.finalized_by === null &&
    value.finalized_at === null &&
    value.actual_at === null &&
    value.outcome === null &&
    value.completed_activity_id === null &&
    value.cancellation_reason === null
  );
}

export const followUpRowSchema = row.refine(statusEvidence, 'Invalid follow-up status evidence.');

export const followUpViewSchema = z.enum([
  'all',
  'open',
  'today',
  'overdue',
  'upcoming',
  'completed',
  'cancelled',
]);

export const followUpQuerySchema = z
  .object({
    leadId: z.uuid().nullable().default(null),
    page: z.number().int().min(0).max(100000).default(0),
    view: followUpViewSchema.default('open'),
    mine: z.boolean().default(true),
  })
  .strict();

export const activityQuerySchema = z
  .object({
    leadId: z.uuid(),
    page: z.number().int().min(0).max(100000).default(0),
  })
  .strict();

export const followUpPageSchema = z.object({
  rows: z
    .array(
      row
        .extend({
          lead_reference: z.number().int().positive(),
          customer_name: z.string(),
          current_owner_id: z.uuid().nullable(),
          read_only: z.boolean(),
          needs_assignment_review: z.boolean(),
        })
        .refine(statusEvidence, 'Invalid follow-up status evidence.'),
    )
    .max(20),
  events: z
    .array(
      z.object({
        id: version,
        lead_id: z.uuid(),
        follow_up_id: z.uuid(),
        actor_id: z.uuid(),
        actions: z
          .array(
            z.enum(['created', 'updated', 'reassigned', 'rescheduled', 'completed', 'cancelled']),
          )
          .min(1)
          .max(2),
        reason: z.string().max(4000).nullable(),
        before_data: followUpRowSchema.nullable(),
        after_data: followUpRowSchema,
        occurred_at: salesTimestampSchema,
      }),
    )
    .max(50),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  page: z.number().int().nonnegative(),
  pageSize: z.literal(20),
  asOf: salesTimestampSchema,
});

export const manualActivityRowSchema = z
  .object({
    id: z.uuid(),
    lead_id: z.uuid(),
    kind: z.enum(['call', 'meeting', 'whatsapp', 'email', 'follow_up']),
    summary: meaningful(160),
    occurred_at: salesTimestampSchema,
    outcome: z.string().max(4000).nullable(),
    notes: z.string().max(4000).nullable(),
    follow_up_id: z.uuid().nullable(),
    created_by: z.uuid(),
    created_at: salesTimestampSchema,
  })
  .refine(
    (value) =>
      value.kind === 'follow_up'
        ? value.follow_up_id !== null && meaningful(4000).safeParse(value.outcome).success
        : value.follow_up_id === null,
    'Invalid activity provenance.',
  );

export const manualActivityPageSchema = z.object({
  rows: z.array(manualActivityRowSchema).max(20),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  page: z.number().int().nonnegative(),
  pageSize: z.literal(20),
  readOnly: z.boolean(),
});

export const followUpSaveSchema = z.object({
  followUp: followUpRowSchema,
  replayed: z.boolean(),
});

export const manualActivitySaveSchema = z.object({
  activity: manualActivityRowSchema,
  replayed: z.boolean(),
});

export type FollowUpQuery = z.infer<typeof followUpQuerySchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export type FollowUpPage = z.infer<typeof followUpPageSchema>;
export type ManualActivityPage = z.infer<typeof manualActivityPageSchema>;
export type FollowUpSave = z.infer<typeof followUpSaveSchema>;
export type ManualActivitySave = z.infer<typeof manualActivitySaveSchema>;
