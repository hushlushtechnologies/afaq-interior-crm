import { z } from 'zod';

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const attachmentMimeSchema = z.enum([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const extensions = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
} as const;

// Display metadata only. Never use this value as a Storage object path.
export const attachmentFilenameSchema = z
  .string()
  .min(1)
  .max(180)
  .refine(
    (value) =>
      value === value.trim() &&
      !/[\p{Cc}\p{Cf}<>:"/\\|?*]/u.test(value) &&
      !value.startsWith('.') &&
      !value.endsWith('.') &&
      !value.includes('..') &&
      !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value),
    'Use a plain filename without paths, control characters or reserved names.',
  )
  .transform((value) => value.normalize('NFC'));

// These are untrusted claims. The server must separately inspect actual bytes.
export const attachmentUploadSchema = z
  .object({
    requestId: z.uuid(),
    leadId: z.uuid(),
    filename: attachmentFilenameSchema,
    declaredMime: attachmentMimeSchema,
    declaredBytes: z.number().int().min(1).max(ATTACHMENT_MAX_BYTES),
  })
  .strict()
  .superRefine((value, context) => {
    const extension = value.filename.split('.').at(-1)?.toLowerCase();
    const allowed: readonly string[] = extensions[value.declaredMime];

    if (!extension || !allowed.includes(extension)) {
      context.addIssue({
        code: 'custom',
        path: ['filename'],
        message: 'The filename extension must match the declared file type.',
      });
    }
  });

export const attachmentReferenceSchema = z
  .object({
    leadId: z.uuid(),
    attachmentId: z.uuid(),
  })
  .strict();

export const attachmentRemovalSchema = attachmentReferenceSchema
  .extend({
    requestId: z.uuid(),
    version: z.number().int().positive().safe(),
  })
  .strict();

export type AttachmentUploadInput = z.infer<typeof attachmentUploadSchema>;
