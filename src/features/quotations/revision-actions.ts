'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { quotationSavedSchema, type QuotationSaved } from './contracts';
import { createQuotationRevisionSchema } from './revision-contracts';

export async function createQuotationRevision(input: unknown): Promise<Result<QuotationSaved>> {
  const parsed = createQuotationRevisionSchema.safeParse(input);

  if (!parsed.success)
    return {
      status: 'error',
      message: 'Enter a reason and use the latest saved draft.',
      retryable: false,
    };

  try {
    await requireCapability('quotations.view');
    await requireCapability('quotations.update');
  } catch {
    return {
      status: 'error',
      message: 'Your quotation permission could not be verified.',
      retryable: false,
    };
  }

  try {
    const client = await createSupabaseServerClient();
    const response = await client.rpc('crm_create_quotation_revision', {
      p_input: parsed.data,
    });

    const messages: Record<string, string> = {
      '42501': 'You cannot create a revision for this quotation.',
      '40001': 'The draft changed. Reload the latest draft before creating a revision.',
      '22023':
        'Check the reason and lead eligibility. A request ID must retain its original content.',
      '23514':
        'The saved draft evidence could not be verified. Reload and contact your administrator.',
      '23503': 'The quotation revision relationship could not be verified.',
      '23505': 'The revision already changed. Reload and review the latest draft.',
    };

    if (response.error && messages[response.error.code])
      return {
        status: 'error',
        message: messages[response.error.code],
        retryable: false,
      };

    const result = quotationSavedSchema.safeParse(response.data);

    if (!response.error && result.success) {
      revalidatePath('/quotations');
      revalidatePath(`/quotations/${parsed.data.quotationId}`);
      revalidatePath('/leads/details/[leadId]', 'page');

      return { status: 'ok', data: result.data };
    }
  } catch {
    /* Unknown outcome: preserve the original request for an idempotent retry. */
  }

  return {
    status: 'error',
    message: 'The result could not be confirmed. Retry the unchanged revision request.',
    retryable: true,
  };
}