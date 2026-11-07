import { z } from 'zod';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();
const date = z.iso.date().refine((value) => !value.startsWith('0000-'), {
  message: 'Enter a valid calendar date.',
});
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const requirementStateSchema = z.enum([
  'not_started',
  'in_progress',
  'completed',
  'needs_clarification',
]);

export const requirementFieldsSchema = z
  .object({
    project_type: text(100),
    property_type: text(100),
    location_description: text(300),
    style_preferences: text(2000),
    material_preferences: text(2000),
    furniture_preferences: text(2000),
    color_preferences: text(2000),
    budget_estimate: z
      .string()
      .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Enter a nonnegative AED amount with up to 2 decimals.')
      .nullable(),
    currency: z.literal('AED'),
    desired_start_date: date.nullable(),
    desired_completion_date: date.nullable(),
    special_instructions: text(4000),
    completion_state: requirementStateSchema,
  })
  .strict()
  .refine(
    (value) =>
      !value.desired_start_date ||
      !value.desired_completion_date ||
      value.desired_completion_date >= value.desired_start_date,
    {
      path: ['desired_completion_date'],
      message: 'Completion must be on or after the start date.',
    },
  );

export const roomFieldsSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a room or space name.').max(160),
    room_type: text(100),
    sort_order: z.number().int().min(0).max(10000),
    requirements_notes: text(4000),
    measurement_notes: text(4000),
    deliverables_notes: text(4000),
  })
  .strict();

export const internalNoteFieldsSchema = z
  .object({ body: z.string().trim().min(1, 'Enter an internal note.').max(4000) })
  .strict();

const base = { requestId: z.uuid(), leadId: z.uuid() };
export const detailCommandSchema = z.discriminatedUnion('command', [
  z
    .object({
      ...base,
      command: z.literal('save_requirements'),
      version: version.nullable(),
      data: requirementFieldsSchema,
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('save_room'),
      recordId: z.uuid(),
      version: version.nullable(),
      data: roomFieldsSchema,
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('save_note'),
      recordId: z.uuid(),
      version: version.nullable(),
      data: internalNoteFieldsSchema,
    })
    .strict(),
]);

export type RequirementFields = z.infer<typeof requirementFieldsSchema>;
export type RoomFields = z.infer<typeof roomFieldsSchema>;
export type InternalNoteFields = z.infer<typeof internalNoteFieldsSchema>;
export type DetailCommand = z.infer<typeof detailCommandSchema>;