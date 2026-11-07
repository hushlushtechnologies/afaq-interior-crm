import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Result } from '@/features/leads/schemas';
import {
  visitPageSchema,
  visitSaveSchema,
  type VisitCommand,
  type VisitQuery,
  type VisitPage,
  type VisitSave,
} from './schemas';

function failure(code?: string): Result<never> {
  const messages: Record<string, string> = {
    '42501': 'Your current account cannot access or change this lead visit.',
    '40001': 'The visit changed, is finalized or its lead is read-only. Cancel and reload.',
    '22023':
      'Check the schedule, current Sales owner, actual time, outcome or cancellation reason. Keep request IDs unique to unchanged requests.',
    '22P02': 'A visit identifier or value has an invalid format.',
    '22007': 'Enter a valid date, time and timezone.',
    '22008': 'Enter a valid calendar date and time.',
    '22009': 'Enter a valid timezone offset.',
    '23514': 'The visit details violate a required status or field rule.',
    '23505': 'The visit already exists. Reload before editing.',
    PGRST202: 'The site-visit database migration is unavailable.',
  };
  return {
    status: 'error',
    message: messages[code ?? ''] ?? 'The result could not be confirmed. Retry the same request.',
    retryable: !messages[code ?? ''],
  };
}
export async function fetchSiteVisits(query: VisitQuery): Promise<Result<VisitPage>> {
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_site_visits', {
      p_lead_id: query.leadId,
      p_page: query.page,
    });
    if (result.error) return failure(result.error.code);
    const data = visitPageSchema.safeParse(result.data);
    return data.success ? { status: 'ok', data: data.data } : failure();
  } catch {
    return failure();
  }
}
export async function saveSiteVisit(command: VisitCommand): Promise<Result<VisitSave>> {
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_save_site_visit', { p_input: command });
    if (result.error) return failure(result.error.code);
    const data = visitSaveSchema.safeParse(result.data);
    return data.success ? { status: 'ok', data: data.data } : failure();
  } catch {
    return failure();
  }
}