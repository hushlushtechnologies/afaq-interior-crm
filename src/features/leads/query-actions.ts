'use server';

import { requireCapability } from '@/features/access/server';
import { pipelineQuerySchema, type PipelinePage } from './query-schemas';
import { fetchPipelinePage } from './query-service';
import type { Result } from './schemas';

export async function queryLeads(input: unknown): Promise<Result<PipelinePage>> {
  const parsed = pipelineQuerySchema.safeParse(input);

  if (!parsed.success)
    return {
      status: 'error',
      message: 'Review the lead filters, calendar dates, page and sorting.',
      retryable: false,
    };

  try {
    await requireCapability('leads.view');
  } catch {
    return {
      status: 'error',
      message: 'Your session or lead visibility could not be verified. Sign in again.',
      retryable: false,
    };
  }

  return fetchPipelinePage(parsed.data);
}
