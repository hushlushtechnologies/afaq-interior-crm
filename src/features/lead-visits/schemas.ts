import { z } from 'zod';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();
const timestamp = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => !value.startsWith('0000-') && Number.isFinite(Date.parse(value)),
    'Enter a valid date, time and timezone.',
  );
const evidence = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Enter a meaningful explanation.')
    .max(max)
    .regex(/[\p{L}\p{N}]/u, 'Include meaningful text.');
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const visitFieldsSchema = z
  .object({
    scheduled_at: timestamp,
    assigned_user_id: z.uuid().nullable(),
    location: text(300),
    notes: text(4000),
    measurements: text(4000),
    observations: text(4000),
  })
  .strict();
const base = { requestId: z.uuid(), leadId: z.uuid(), visitId: z.uuid() };
export const visitCommandSchema = z.discriminatedUnion('command', [
  z
    .object({ ...base, command: z.literal('create'), version: z.null(), data: visitFieldsSchema })
    .strict(),
  z.object({ ...base, command: z.literal('update'), version, data: visitFieldsSchema }).strict(),
  z
    .object({
      ...base,
      command: z.literal('complete'),
      version,
      data: z
        .object({
          actual_at: timestamp.refine(
            (value) => Date.parse(value) <= Date.now(),
            'Actual visit time cannot be in the future.',
          ),
          outcome: evidence(4000),
        })
        .strict(),
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
export const visitRowSchema = visitFieldsSchema.extend({
  id: z.uuid(),
  lead_id: z.uuid(),
  status: z.enum(['planned', 'completed', 'cancelled']),
  actual_at: timestamp.nullable(),
  outcome: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  finalized_by: z.uuid().nullable(),
  finalized_at: timestamp.nullable(),
  created_by: z.uuid(),
  created_at: timestamp,
  updated_by: z.uuid(),
  updated_at: timestamp,
  version,
});
export const visitPageSchema = z.object({
  rows: z.array(visitRowSchema.extend({ needs_assignment_review: z.boolean() })).max(20),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.literal(20),
  readOnly: z.boolean(),
  owner: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  events: z
    .array(
      z.object({
        id: z.number().int().positive(),
        lead_id: z.uuid(),
        visit_id: z.uuid(),
        actor_id: z.uuid(),
        actions: z
          .array(
            z.enum([
              'created',
              'scheduled',
              'assigned',
              'updated',
              'status_changed',
              'completed',
              'cancelled',
            ]),
          )
          .min(1)
          .max(3),
        before_data: visitRowSchema.nullable(),
        after_data: visitRowSchema,
        occurred_at: timestamp,
      }),
    )
    .max(50),
});
export const visitQuerySchema = z
  .object({ leadId: z.uuid(), page: z.number().int().min(0).max(10000).default(0) })
  .strict();
export const visitSaveSchema = z.object({ visit: visitRowSchema, replayed: z.boolean() });
export type VisitCommand = z.infer<typeof visitCommandSchema>;
export type VisitFields = z.infer<typeof visitFieldsSchema>;
export type VisitRow = z.infer<typeof visitRowSchema>;
export type VisitPage = z.infer<typeof visitPageSchema>;
export type VisitQuery = z.infer<typeof visitQuerySchema>;
export type VisitSave = z.infer<typeof visitSaveSchema>;

export function toDubaiInput(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function fromDubaiInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00+04:00`);
  return Number.isFinite(parsed.getTime()) && toDubaiInput(parsed.toISOString()) === value
    ? parsed.toISOString()
    : null;
}