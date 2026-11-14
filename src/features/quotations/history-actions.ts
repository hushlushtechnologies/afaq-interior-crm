'use server';

import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  historyQuerySchema,
  snapshotQuerySchema,
  quotationHistorySchema,
  quotationSnapshotSchema,
  type QuotationHistoryPage,
  type QuotationSnapshot,
} from './history-contracts';

export async function loadQuotationHistory(input: unknown): Promise<Result<QuotationHistoryPage>> {
  const query = historyQuerySchema.safeParse(input);

  if (!query.success)
    return { status: 'error', message: 'Choose a valid history page.', retryable: false };

  try {
    await requireCapability('quotations.view');

    const client = await createSupabaseServerClient();
    const response = await client.rpc('crm_quotation_history', {
      p_id: query.data.id,
      p_page: query.data.page,
    });

    const parsed = quotationHistorySchema.safeParse(response.data);

    if (!response.error && parsed.success) return { status: 'ok', data: parsed.data };
  } catch {
    /* Fail closed; do not log snapshot contents. */
  }

  return {
    status: 'error',
    message: 'Quotation history could not be loaded or is no longer permitted.',
    retryable: true,
  };
}

export async function loadQuotationSnapshot(input: unknown): Promise<Result<QuotationSnapshot>> {
  const query = snapshotQuerySchema.safeParse(input);

  if (!query.success)
    return { status: 'error', message: 'Choose a valid saved version.', retryable: false };

  try {
    await requireCapability('quotations.view');

    const client = await createSupabaseServerClient();
    const response = await client.rpc('crm_quotation_snapshot', {
      p_id: query.data.id,
      p_version: query.data.version,
    });

    const parsed = quotationSnapshotSchema.safeParse(response.data);

    if (!response.error && parsed.success) return { status: 'ok', data: parsed.data };
  } catch {
    /* Fail closed; do not log snapshot contents. */
  }

  return {
    status: 'error',
    message: 'The saved version could not be loaded or is no longer permitted.',
    retryable: true,
  };
}