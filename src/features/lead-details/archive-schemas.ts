import { z } from 'zod';

export const archiveDetailSchema = z
  .object({
    requestId: z.uuid(),
    leadId: z.uuid(),
    recordId: z.uuid(),
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export type ArchiveDetail = z.infer<typeof archiveDetailSchema>;