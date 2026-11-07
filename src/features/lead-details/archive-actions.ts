'use server';

import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { archiveDetailSchema } from './archive-schemas';
import {
  detailPageSchema,
  detailQuerySchema,
  detailSaveSchema,
  type DetailPage,
  type DetailSave,
} from './contracts';

const denied = {
  status: 'error',
  message: 'Your session or lead permission could not be verified.',
  retryable: false,
} as const;
function failure(code?: string): Result<never> {
  const messages: Record<string, string> = {
    '42501': 'Your current account cannot access or archive these details.',
    '40001': 'The record changed or is read-only. Cancel and reload before trying again.',
    '22023': 'Review the archive request. A request ID cannot be reused for changed input.',
    '22P02': 'A record identifier is invalid.',
    PGRST202: 'The detail-archive database migration is unavailable.',
  };
  return {
    status: 'error',
    message: messages[code ?? ''] ?? 'The result could not be confirmed. Retry the same request.',
    retryable: !messages[code ?? ''],
  };
}
export async function archiveLeadDetail(input: unknown): Promise<Result<DetailSave>> {
  const parsed = archiveDetailSchema.safeParse(input);
  if (!parsed.success)
    return { status: 'error', message: 'Choose a valid record and version.', retryable: false };
  try {
    await requireCapability('leads.view');
    await requireCapability('leads.archive');
  } catch {
    return denied;
  }
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_archive_lead_detail', { p_input: parsed.data });
    if (result.error) return failure(result.error.code);
    const data = detailSaveSchema.safeParse(result.data);
    return data.success ? { status: 'ok', data: data.data } : failure();
  } catch {
    return failure();
  }
}
export async function loadArchivedLeadDetails(input: unknown): Promise<Result<DetailPage>> {
  const parsed = detailQuerySchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Choose a valid lead, detail type and page.',
      retryable: false,
    };
  try {
    await requireCapability('leads.view');
  } catch {
    return denied;
  }
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_archived_lead_details', {
      p_lead_id: parsed.data.leadId,
      p_kind: parsed.data.kind,
      p_page: parsed.data.page,
    });
    if (result.error) return failure(result.error.code);
    const data = detailPageSchema.safeParse(result.data);
    return data.success ? { status: 'ok', data: data.data } : failure();
  } catch {
    return failure();
  }
}