import { z } from 'zod';
import { leadFieldsSchema } from '@/features/leads/schemas';

const evidence = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/[\p{L}\p{N}]/u, 'Include meaningful text.');

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .transform((value) => value || null)
  .nullable();

export const salesTimestampSchema = z.iso
  .datetime({ offset: true })
  .refine(
    (value) =>
      !value.startsWith('0000-') && !/\.\d{7,}/.test(value) && Number.isFinite(Date.parse(value)),
    'Enter a valid timestamp with its timezone.',
  );

const actualTimestamp = salesTimestampSchema.refine(
  (value) => Date.parse(value) <= Date.now(),
  'Actual activity time cannot be in the future.',
);

const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

// Existing site visits, notes and automatic audit events are separate sources.
// These kinds represent manual logs, never proof of delivery by an integration.
export const manualActivityKindSchema = z.enum(['call', 'meeting', 'whatsapp', 'email']);

export const manualActivityCommandSchema = z
  .object({
    requestId: z.uuid(),
    leadId: z.uuid(),
    activityId: z.uuid(),
    command: z.literal('log'),
    data: z
      .object({
        kind: manualActivityKindSchema,
        summary: evidence(160),
        occurred_at: actualTimestamp,
        outcome: optionalText,
        notes: optionalText,
      })
      .strict(),
  })
  .strict();

export const followUpStatusSchema = z.enum(['open', 'completed', 'cancelled']);

export const followUpKindSchema = z.enum([
  'call',
  'meeting',
  'site_visit',
  'whatsapp',
  'email',
  'follow_up',
]);

export const followUpFieldsSchema = z
  .object({
    title: evidence(160),
    description: optionalText,
    kind: followUpKindSchema,
    priority: leadFieldsSchema.shape.priority,
    assigned_user_id: z.uuid(),
    due_at: salesTimestampSchema,
  })
  .strict();

const base = {
  requestId: z.uuid(),
  leadId: z.uuid(),
  followUpId: z.uuid(),
};

export const followUpCommandSchema = z.discriminatedUnion('command', [
  z
    .object({
      ...base,
      command: z.literal('create'),
      version: z.null(),
      data: followUpFieldsSchema,
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('update'),
      version,
      data: followUpFieldsSchema.omit({ due_at: true }).strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('reschedule'),
      version,
      data: z.object({ due_at: salesTimestampSchema, reason: evidence(2000) }).strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('complete'),
      version,
      data: z.object({ actual_at: actualTimestamp, outcome: evidence(4000) }).strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('cancel'),
      version,
      data: z.object({ reason: evidence(2000) }).strict(),
    })
    .strict(),
]);

function dubaiDay(value: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;

  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Display/filter preview only. Database queries must use trusted server time.
// Today and overdue intentionally overlap for an open task due earlier today.
export function followUpTimeFlags(
  dueAt: string,
  status: z.infer<typeof followUpStatusSchema>,
  now: string,
) {
  const due = salesTimestampSchema.parse(dueAt);
  const clock = salesTimestampSchema.parse(now);
  const state = followUpStatusSchema.parse(status);
  const open = state === 'open';

  return {
    today: open && dubaiDay(due) === dubaiDay(clock),
    overdue: open && Date.parse(due) < Date.parse(clock),
    upcoming: open && Date.parse(due) >= Date.parse(clock),
    completed: state === 'completed',
    cancelled: state === 'cancelled',
  };
}

export type FollowUpCommand = z.infer<typeof followUpCommandSchema>;
export type FollowUpFields = z.infer<typeof followUpFieldsSchema>;
export type ManualActivityCommand = z.infer<typeof manualActivityCommandSchema>;
