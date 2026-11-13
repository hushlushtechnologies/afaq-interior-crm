import { z } from 'zod';
import { pipelineQuerySchema } from '@/features/leads/query-schemas';

export const exportQuerySchema = pipelineQuerySchema.transform((query) => ({
  ...query,
  page: 0,
  pageSize: 20 as const,
}));
export const exportSnapshotSchema = z.object({
  id: z.uuid(),
  asOf: z.iso.datetime({ offset: true }),
  rows: z.array(z.array(z.string().max(4000).nullable()).length(19)).max(1000),
});
export const LEAD_EXPORT_HEADERS = [
  'Reference',
  'Customer name',
  'Email',
  'Primary phone',
  'Alternate phone',
  'Source code',
  'Source',
  'Stage',
  'Priority',
  'Owner',
  'Property type',
  'Location',
  'Intake budget (AED)',
  'Currency',
  'Inquiry date',
  'Expected start date',
  'Intake follow-up date',
  'Created at (UTC)',
  'Archived at (UTC)',
] as const;