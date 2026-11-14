import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Result } from '@/features/leads/schemas';
import { quotationDraftSchema } from './schemas';
import {
  quotationReadSchema,
  quotationRecordSchema,
  quotationSavedSchema,
  type QuotationRecord,
  type QuotationSaved,
} from './contracts';

function failure(code?: string): Result<never> {
  const messages: Record<string, string> = {
    '42501': 'Your account cannot perform this quotation operation or no longer has access.',
    '40001': 'This draft changed. Reload, review it and save using a new request ID.',
    '22023':
      'Check the draft, room links and discounts. Reuse a request ID only with its original content.',
    '23514': 'A quotation value exceeds its supported limits.',
    '23503': 'The linked lead or quotation is unavailable.',
    '22P02': 'A quotation field has an invalid format.',
  };
  return {
    status: 'error',
    message:
      messages[code ?? ''] ??
      'The result could not be confirmed. Retry the unchanged request with the same request ID.',
    retryable: !messages[code ?? ''],
  };
}

export async function saveQuotationDraft(input: unknown): Promise<Result<QuotationSaved>> {
  const parsed = quotationDraftSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Check the required quotation fields, dates and decimal values.',
      retryable: false,
    };
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_save_quotation_draft', { p_input: parsed.data });
    if (result.error) return failure(result.error.code);
    const output = quotationSavedSchema.safeParse(result.data);
    return output.success ? { status: 'ok', data: output.data } : failure();
  } catch {
    return failure();
  }
}

export async function fetchQuotation(input: unknown): Promise<Result<QuotationRecord>> {
  const parsed = quotationReadSchema.safeParse(input);
  if (!parsed.success)
    return { status: 'error', message: 'Choose a valid quotation.', retryable: false };
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_get_quotation', { p_id: parsed.data.id });
    if (result.error) return failure(result.error.code);
    const output = quotationRecordSchema.safeParse(result.data);
    return output.success ? { status: 'ok', data: output.data } : failure();
  } catch {
    return failure();
  }
}
