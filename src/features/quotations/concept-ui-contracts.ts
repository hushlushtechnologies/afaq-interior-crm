import { z } from 'zod';
import { conceptPageSchema } from './concept-contracts';

export const conceptWorkspaceQuerySchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().min(1).max(2147483647),
    page: z.number().int().min(0).max(10000),
    archived: z.boolean(),
    imagePage: z.number().int().min(0).max(10000),
  })
  .strict();
export const conceptContextSchema = z
  .object({
    imagePage: z.number().int().nonnegative(),
    pageSize: z.literal(20),
    imageTotal: z.number().int().nonnegative(),
    images: z
      .array(
        z
          .object({
            id: z.uuid(),
            filename: z.string(),
            mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
            createdAt: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .max(20),
    events: z
      .array(
        z
          .object({
            id: z.uuid(),
            referenceId: z.uuid(),
            actorId: z.uuid(),
            action: z.enum(['registered', 'selected', 'deselected', 'archived']),
            version: z.number().int().positive(),
            occurredAt: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
export const conceptWorkspaceSchema = z
  .object({ references: conceptPageSchema, context: conceptContextSchema })
  .strict();
export const conceptPreviewTargetSchema = z
  .object({
    leadId: z.uuid(),
    attachmentId: z.uuid(),
    version: z.number().int().positive(),
  })
  .strict();
export const conceptPreviewQuerySchema = z.object({ id: z.uuid(), referenceId: z.uuid() }).strict();
export type ConceptWorkspace = z.infer<typeof conceptWorkspaceSchema>;