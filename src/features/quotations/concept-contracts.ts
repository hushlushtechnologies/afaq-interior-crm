import { z } from 'zod';

const counter = z.number().int().min(1).max(2147483647);
const base = { requestId: z.uuid(), quotationId: z.uuid(), revision: counter };
export const conceptCommandSchema = z.discriminatedUnion('command', [
  z
    .object({
      ...base,
      command: z.literal('register'),
      data: z
        .object({
          attachmentId: z.uuid(),
          roomId: z.uuid().nullable(),
          title: z.string().trim().min(2).max(160),
          promptNotes: z.string().trim().max(2000).nullable(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('select'),
      data: z
        .object({
          id: z.uuid(),
          version: counter,
          selected: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('archive'),
      data: z
        .object({
          id: z.uuid(),
          version: counter,
        })
        .strict(),
    })
    .strict(),
]);
export const conceptQuerySchema = z
  .object({
    id: z.uuid(),
    revision: counter,
    page: z.number().int().min(0).max(10000),
    archived: z.boolean(),
  })
  .strict();
export const conceptSavedSchema = z
  .object({
    id: z.uuid(),
    version: counter,
    selected: z.boolean(),
    archived: z.boolean(),
    replayed: z.boolean(),
  })
  .strict();
export const conceptPageSchema = z
  .object({
    page: z.number().int().min(0).max(10000),
    pageSize: z.literal(20),
    total: z.number().int().nonnegative(),
    canEdit: z.boolean(),
    rows: z
      .array(
        z
          .object({
            id: z.uuid(),
            revision: counter,
            version: counter,
            title: z.string(),
            promptNotes: z.string().nullable(),
            attachmentId: z.uuid(),
            roomId: z.uuid().nullable(),
            origin: z.literal('existing_reference'),
            generationState: z.literal('not_requested'),
            selected: z.boolean(),
            createdBy: z.uuid(),
            createdAt: z.iso.datetime({ offset: true }),
            archivedAt: z.iso.datetime({ offset: true }).nullable(),
            available: z.boolean(),
            filename: z.string(),
            mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
          })
          .strict(),
      )
      .max(20),
    generation: z
      .object({
        enabled: z.literal(false),
        status: z.literal('blocked_unconfigured'),
        provider: z.null(),
        recordedGeneratedImages: z.literal(0),
        confirmedCost: z.null(),
      })
      .strict(),
  })
  .strict();
export type ConceptPage = z.infer<typeof conceptPageSchema>;
export type ConceptSaved = z.infer<typeof conceptSavedSchema>;