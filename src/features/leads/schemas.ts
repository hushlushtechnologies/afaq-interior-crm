import { z } from 'zod';
import { DEMO_STAGES } from '@/lib/demo/stages';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const parsed = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
  }, 'Enter a valid calendar date.');

const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Use an international phone number, such as +971501234567.')
  .nullable();

export const leadFieldsSchema = z
  .object({
    customer_name: z
      .string()
      .trim()
      .min(2, 'Enter at least 2 characters for the customer name.')
      .max(160),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase())
      .nullable(),
    phone,
    alternate_phone: phone,
    source_code: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    assigned_user_id: z.uuid().nullable(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    property_type: optionalText(100),
    location: optionalText(300),
    budget: z
      .string()
      .regex(
        /^\d{1,12}(\.\d{1,2})?$/,
        'Enter a nonnegative AED amount with up to 2 decimal places.',
      )
      .nullable(),
    expected_start_on: date.nullable(),
    inquiry_on: date,
    follow_up_on: date.nullable(),
    description: optionalText(4000),
    initial_note: optionalText(2000),
  })
  .strict();

export type LeadFields = z.infer<typeof leadFieldsSchema>;

export const leadRowSchema = leadFieldsSchema.omit({ budget: true }).extend({
  assigned_name: z.string().nullable().optional(),
  id: z.uuid(),
  reference: z.number().int().positive(),
  budget: z.number().nonnegative().nullable(),
  currency: z.literal('AED'),
  stage: z.enum(DEMO_STAGES.map((stage) => stage.id)),
  current_loss_id: z.uuid().nullable().optional(),
  qualification_status: z.literal('unreviewed'),
  external_id: z.string().nullable(),
  created_by: z.uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int().positive(),
  archived_at: z.string().nullable(),
});

export type LeadRow = z.infer<typeof leadRowSchema>;

export const leadPageSchema = z.object({
  rows: z.array(leadRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  events: z.array(
    z.object({ id: z.number(), actor_id: z.uuid(), action: z.string(), occurred_at: z.string() }),
  ),
});

export type LeadPage = z.infer<typeof leadPageSchema>;

export const leadOptionsSchema = z.object({
  sources: z.array(z.object({ code: z.string(), name: z.string(), active: z.boolean() })),
  owners: z.array(z.object({ id: z.uuid(), name: z.string() })),
});

export type LeadOptions = z.infer<typeof leadOptionsSchema>;

export const leadQuerySchema = z
  .object({
    page: z.number().int().min(0).max(10000),
    archived: z.boolean(),
    id: z.uuid().nullable(),
  })
  .strict();

const base = { requestId: z.uuid(), leadId: z.uuid(), version: z.number().int().positive() };

export const leadCommandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('create'), requestId: z.uuid(), data: leadFieldsSchema }).strict(),
  z.object({ command: z.literal('update'), ...base, data: leadFieldsSchema }).strict(),
  z
    .object({
      command: z.literal('assign'),
      ...base,
      data: z.object({ assigned_user_id: z.uuid().nullable() }).strict(),
    })
    .strict(),
  z.object({ command: z.literal('archive'), ...base, data: z.object({}).strict() }).strict(),
]);

export type LeadCommand = z.infer<typeof leadCommandSchema>;

export const leadSaveSchema = z.object({
  lead: leadRowSchema,
  replayed: z.boolean(),
  possibleDuplicate: z.boolean(),
});

export type LeadSave = z.infer<typeof leadSaveSchema>;

export type Result<T> =
  { status: 'ok'; data: T } | { status: 'error'; message: string; retryable: boolean };
