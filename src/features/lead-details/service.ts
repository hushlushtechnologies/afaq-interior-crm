import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Result } from '@/features/leads/schemas';
import {
  detailPageSchema,
  detailSaveSchema,
  type DetailPage,
  type DetailQuery,
  type DetailSave,
} from './contracts';
import type { DetailCommand } from './schemas';

function failure(code?: string): Result<never> {
  const messages: Record<string, string> = {
    '42501': 'Your current account cannot access or change these lead details.',
    '40001':
      'This record changed or the lead is read-only. Reload and review before submitting again.',
    '22023': 'Check the details and request ID. A request ID cannot be reused for changed input.',
    '22P02': 'A record identifier or value has an invalid format.',
    '23514': 'Some details violate the allowed fields, dates or value limits.',
    '23505': 'This record already exists. Reload before editing it.',
    '22003': 'A record value or version exceeds its supported range.',
    PGRST202:
      'The lead-details database migration is unavailable. Ask your administrator to verify setup.',
  };
  return {
    status: 'error',
    message: messages[code ?? ''] ?? 'The result could not be confirmed. Retry the same request.',
    retryable: !messages[code ?? ''],
  };
}

export async function fetchLeadDetails(query: DetailQuery): Promise<Result<DetailPage>> {
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_lead_details', {
      p_lead_id: query.leadId,
      p_kind: query.kind,
      p_page: query.page,
    });
    if (result.error) return failure(result.error.code);
    const parsed = detailPageSchema.safeParse(result.data);
    return parsed.success ? { status: 'ok', data: parsed.data } : failure();
  } catch {
    return failure();
  }
}

export async function saveLeadDetail(command: DetailCommand): Promise<Result<DetailSave>> {
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_save_lead_detail', { p_input: command });
    if (result.error) return failure(result.error.code);
    const parsed = detailSaveSchema.safeParse(result.data);
    return parsed.success ? { status: 'ok', data: parsed.data } : failure();
  } catch {
    return failure();
  }
}