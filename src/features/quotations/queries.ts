'use server';

import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  quotationQuerySchema,
  quotationPageSchema,
  quotationContextQuerySchema,
  quotationContextSchema,
  type QuotationPage,
  type QuotationContext,
} from './query-contracts';

export async function loadQuotationPage(input: unknown): Promise<Result<QuotationPage>> {
  const query = quotationQuerySchema.safeParse(input);
  if (!query.success)
    return { status: 'error', message: 'Choose valid quotation filters.', retryable: false };

  try {
    await requireCapability('quotations.view');
    const client = await createSupabaseServerClient();
    const response = await client.rpc('crm_quotation_page', { p_query: query.data });
    const parsed = quotationPageSchema.safeParse(response.data);
    if (!response.error && parsed.success) return { status: 'ok', data: parsed.data };
    return {
      status: 'error',
      message: 'Quotations could not be loaded. Reload or check your current access.',
      retryable: true,
    };
  } catch {
    return {
      status: 'error',
      message: 'Quotation access could not be confirmed. Reload or sign in again.',
      retryable: true,
    };
  }
}

export async function loadQuotationContext(input: unknown): Promise<Result<QuotationContext>> {
  const query = quotationContextQuerySchema.safeParse(input);
  if (!query.success)
    return { status: 'error', message: 'Choose a valid lead or quotation.', retryable: false };

  try {
    await requireCapability('quotations.view');
    const client = await createSupabaseServerClient();
    const response = await client.rpc('crm_quotation_context', {
      p_lead_id: query.data.leadId,
      p_quotation_id: query.data.quotationId,
    });
    const parsed = quotationContextSchema.safeParse(response.data);
    if (!response.error && parsed.success) return { status: 'ok', data: parsed.data };
    return {
      status: 'error',
      message: 'Quotation context is unavailable or no longer permitted.',
      retryable: false,
    };
  } catch {
    return {
      status: 'error',
      message: 'Quotation context could not be confirmed. Reload or sign in again.',
      retryable: true,
    };
  }
}
