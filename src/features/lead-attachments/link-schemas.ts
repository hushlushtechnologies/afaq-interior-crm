import { z } from 'zod';

export const attachmentLinkKindSchema = z.enum(['room', 'visit']);

const base = {
  requestId: z.uuid(),
  leadId: z.uuid(),
  attachmentId: z.uuid(),
};

export const attachmentLinkCommandSchema = z.discriminatedUnion('command', [
  z
    .object({
      ...base,
      command: z.literal('link'),
      data: z
        .object({
          kind: attachmentLinkKindSchema,
          targetId: z.uuid(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      command: z.literal('unlink'),
      data: z
        .object({
          linkId: z.uuid(),
          version: z.number().int().positive().max(2147483647),
        })
        .strict(),
    })
    .strict(),
]);

export const attachmentLinkQuerySchema = z
  .object({
    leadId: z.uuid(),
    attachmentId: z.uuid(),
    kind: attachmentLinkKindSchema,
    targetPage: z.number().int().min(0).max(100000),
    page: z.number().int().min(0).max(100000),
  })
  .strict();

const timestamp = z.iso.datetime({ offset: true });

export const attachmentLinkPageSchema = z.object({
  targets: z
    .array(z.object({ id: z.uuid(), label: z.string(), state: z.string(), writable: z.boolean() }))
    .max(20),
  targetTotal: z.number().int().nonnegative(),
  targetPage: z.number().int().nonnegative(),
  links: z
    .array(
      z.object({
        id: z.uuid(),
        version: z.number().int().positive(),
        kind: attachmentLinkKindSchema,
        label: z.string(),
        created_by: z.uuid(),
        created_at: timestamp,
        archived_by: z.uuid().nullable(),
        archived_at: timestamp.nullable(),
        canUnlink: z.boolean(),
      }),
    )
    .max(20),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.literal(20),
  canLink: z.boolean(),
});

export const attachmentLinkSaveSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  archived: z.boolean(),
  replayed: z.boolean(),
});

export type AttachmentLinkCommand = z.infer<typeof attachmentLinkCommandSchema>;
export type AttachmentLinkPage = z.infer<typeof attachmentLinkPageSchema>;