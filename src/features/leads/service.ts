import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  leadOptionsSchema,
  leadPageSchema,
  leadSaveSchema,
  type LeadCommand,
  type LeadOptions,
  type LeadPage,
  type LeadSave,
  type Result,
} from './schemas';

function failure(code?: string): Result<never> {
  const messages: Record<string, string> = {
    '42501': 'Your current account does not have permission for this lead operation.',
    '40001': 'The lead changed or was archived. Reload and review its current values.',
    '22023': 'The request or assignee is invalid. Review the details and reload if necessary.',
    '23514': 'Some lead details are invalid. Check the name, phone numbers and budget.',
    '22007': 'Enter valid calendar dates.',
    '22008': 'Enter valid calendar dates.',
    '22P02': 'Some lead details have an invalid format.',
    '23503': 'A referenced source or account is unavailable.',
  };
  return {
    status: 'error',
    message: messages[code ?? ''] ?? 'The result could not be confirmed. Retry the same request.',
    retryable: !messages[code ?? ''],
  };
}

export async function fetchLeadPage(query: {
  page: number;
  archived: boolean;
  id: string | null;
}): Promise<Result<LeadPage>> {
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_lead_page', {
      p_page: query.page,
      p_archived: query.archived,
      p_id: query.id,
    });
    if (result.error) return failure(result.error.code);
    const parsed = leadPageSchema.safeParse(result.data);
    return parsed.success ? { status: 'ok', data: parsed.data } : failure();
  } catch {
    return failure();
  }
}

export async function fetchLeadOptions(): Promise<Result<LeadOptions>> {
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_lead_options');
    if (result.error) return failure(result.error.code);
    const parsed = leadOptionsSchema.safeParse(result.data);
    return parsed.success ? { status: 'ok', data: parsed.data } : failure();
  } catch {
    return failure();
  }
}

export async function saveLead(command: LeadCommand): Promise<Result<LeadSave>> {
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_save_lead', {
      p_request_id: command.requestId,
      p_command: command.command,
      p_lead_id: command.command === 'create' ? null : command.leadId,
      p_version: command.command === 'create' ? null : command.version,
      p_data: command.data,
    });
    if (result.error) return failure(result.error.code);
    const parsed = leadSaveSchema.safeParse(result.data);
    return parsed.success ? { status: 'ok', data: parsed.data } : failure();
  } catch {
    return failure();
  }
}
