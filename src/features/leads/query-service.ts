import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Result } from './schemas';
import { pipelinePageSchema, type PipelinePage, type PipelineQuery } from './query-schemas';

export async function fetchPipelinePage(query: PipelineQuery): Promise<Result<PipelinePage>> {
  try {
    const client = await createSupabaseServerClient();
    const response = await client.rpc('crm_query_leads', { p_query: query });

    if (response.error) {
      return {
        status: 'error',
        message:
          response.error.code === '42501'
            ? 'Your current account cannot view these leads.'
            : response.error.code === '22023'
              ? 'Review the lead filters, dates and sorting.'
              : 'Leads could not be loaded. Try loading them again.',
        retryable: !['42501', '22023'].includes(response.error.code),
      };
    }

    const parsed = pipelinePageSchema.safeParse(response.data);
    if (parsed.success) return { status: 'ok', data: parsed.data };
  } catch {
    // Return a safe message, never raw database responses or credentials.
  }

  return {
    status: 'error',
    message: 'Leads could not be loaded. Try again.',
    retryable: true,
  };
}
