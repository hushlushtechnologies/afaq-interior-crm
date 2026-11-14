'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { quotationDraftSchema } from './schemas';
import { quotationReadSchema, type QuotationRecord, type QuotationSaved } from './contracts';
import { fetchQuotation, saveQuotationDraft } from './service';

const denied = {
  status: 'error',
  message: 'Your session or quotation permission could not be verified. Reload or sign in again.',
  retryable: false,
} as const;

export async function submitQuotationDraft(input: unknown): Promise<Result<QuotationSaved>> {
  const parsed = quotationDraftSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: `Check ${parsed.error.issues[0]?.path.join('.') || 'quotation details'}: ${parsed.error.issues[0]?.message || 'Invalid input.'}`,
      retryable: false,
    };

  try {
    await requireCapability(parsed.data.quotationId ? 'quotations.update' : 'quotations.create');
    await requireCapability('quotations.view');
  } catch {
    return denied;
  }

  const result = await saveQuotationDraft(parsed.data);
  if (result.status === 'ok') {
    revalidatePath('/quotations');
    revalidatePath(`/quotations/${result.data.id}`);
    revalidatePath(`/leads/details/${parsed.data.leadId}`);
  }
  return result;
}

export async function loadQuotation(input: unknown): Promise<Result<QuotationRecord>> {
  const parsed = quotationReadSchema.safeParse(input);
  if (!parsed.success)
    return { status: 'error', message: 'Choose a valid quotation.', retryable: false };

  try {
    await requireCapability('quotations.view');
  } catch {
    return denied;
  }
  return fetchQuotation(parsed.data);
}
