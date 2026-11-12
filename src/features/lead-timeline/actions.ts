'use server';

import { requireCapability } from '@/features/access/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Result } from '@/features/leads/schemas';
import { timelineQuerySchema, timelinePageSchema, type TimelinePage } from './contracts';

export async function loadLeadTimeline(input: unknown): Promise<Result<TimelinePage>> {
  const query = timelineQuerySchema.safeParse(input);

  if (!query.success)
    return {
      status: 'error',
      message: 'Choose a valid lead and timeline page.',
      retryable: false,
    };

  try {
    await requireCapability('leads.view');
  } catch {
    return {
      status: 'error',
      message: 'Your session or lead permission could not be verified.',
      retryable: false,
    };
  }

  try {
    const client = await createSupabaseServerClient();

    const response = await client.rpc('crm_lead_timeline', {
      p_lead_id: query.data.leadId,
      p_page: query.data.page,
    });

    if (response.error)
      return {
        status: 'error',
        message:
          response.error.code === '42501'
            ? 'Your current account cannot access this lead timeline.'
            : 'Timeline unavailable. Check the local migration and retry loading.',
        retryable: response.error.code !== '42501',
      };

    const parsed = timelinePageSchema.safeParse(response.data);

    if (parsed.success) return { status: 'ok', data: parsed.data };
  } catch {
    /* Return a safe failure without database details. */
  }

  return {
    status: 'error',
    message: 'Timeline could not be loaded. Retry loading.',
    retryable: true,
  };
}
