import 'server-only';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Result } from '@/features/leads/schemas';
import type { FollowUpCommand, ManualActivityCommand } from './schemas';
import {
  followUpPageSchema,
  followUpSaveSchema,
  manualActivityPageSchema,
  manualActivitySaveSchema,
  type FollowUpQuery,
  type ActivityQuery,
} from './contracts';

function failure(code?: string): Result<never> {
  const messages: Record<string, string> = {
    '42501': 'Your current account cannot access or change this lead activity.',
    '40001': 'The record changed, is finalized or its lead is read-only. Reload before editing.',
    '22023':
      'Check the current active Sales owner, required fields, time and reason. Reuse a request ID only for an unchanged retry.',
    '22P02': 'An identifier or value has an invalid format.',
    '22007': 'Enter a valid date, time and timezone.',
    '22008': 'Enter a valid calendar date and time.',
    '22009': 'Enter a valid timezone offset.',
    '23502': 'Required activity information is missing.',
    '23514': 'A field or status rule was not satisfied.',
    '23503': 'The related lead or activity is unavailable.',
    '23505': 'This record already exists. Reload before editing.',
    PGRST202: 'The follow-up database migration is unavailable.',
  };

  return {
    status: 'error',
    message:
      messages[code ?? ''] ??
      'The result could not be confirmed. Retry the same unchanged request.',
    retryable: !messages[code ?? ''],
  };
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<Result<T>> {
  try {
    const client = await createSupabaseServerClient();
    const response = await client.rpc(name, args);

    if (response.error) return failure(response.error.code);

    const parsed = schema.safeParse(response.data);

    return parsed.success ? { status: 'ok', data: parsed.data } : failure();
  } catch {
    return failure();
  }
}

export async function fetchFollowUps(query: FollowUpQuery) {
  return rpc(
    'crm_follow_up_page',
    {
      p_lead_id: query.leadId,
      p_page: query.page,
      p_view: query.view,
      p_mine: query.mine,
    },
    followUpPageSchema,
  );
}

export async function fetchManualActivities(query: ActivityQuery) {
  return rpc(
    'crm_manual_activity_page',
    {
      p_lead_id: query.leadId,
      p_page: query.page,
    },
    manualActivityPageSchema,
  );
}

export async function saveFollowUp(command: FollowUpCommand) {
  return rpc('crm_save_follow_up', { p_input: command }, followUpSaveSchema);
}

export async function logManualActivity(command: ManualActivityCommand) {
  return rpc('crm_log_manual_activity', { p_input: command }, manualActivitySaveSchema);
}
