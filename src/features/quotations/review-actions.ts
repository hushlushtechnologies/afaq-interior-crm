'use server';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getApplicationOrigin } from '@/lib/supabase/server-config';
import {
  reviewSubmissionSchema,
  reviewSubmissionResultSchema,
  quotationReviewSchema,
  type ReviewSubmissionResult,
  type QuotationReview,
  reviewDecisionSchema,
  reviewDecisionResultSchema,
  type ReviewDecisionResult,
} from './review-contracts';

function localEnabled() {
  if (
    process.env.ENABLE_LOCAL_QUOTATION_APPROVALS !== 'true' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:57421'
  )
    return false;
  const app = new URL(getApplicationOrigin());
  return (
    app.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(app.hostname) &&
    /^project_id\s*=\s*"afaq-interiors-crm-s09-local"\s*$/m.test(
      readFileSync(resolve('supabase/config.toml'), 'utf8'),
    )
  );
}
function failure(code?: string): Result<never> {
  const messages: Record<string, string> = {
    disabled: 'Local quotation review operations are disabled.',
    access: 'Your current session or review permission could not be verified.',
    '42501': 'Review access is unavailable, the reviewer is ineligible, or the revision is locked.',
    '40001': 'The quotation changed or was already submitted. Reload its review state.',
    '22023':
      'Check the saved version, reviewer, decision feedback, validity and selected evidence.',
    '23514': 'Saved quotation evidence could not be verified.',
    '54000': 'The selected evidence exceeds the review snapshot resource limit.',
    PGRST202: 'The local review-submission migration is unavailable.',
  };
  return {
    status: 'error',
    message: messages[code ?? ''] ?? 'The outcome is unconfirmed. Retry the same request.',
    retryable: !messages[code ?? ''],
  };
}
export async function submitQuotationReview(
  input: unknown,
): Promise<Result<ReviewSubmissionResult>> {
  const parsed = reviewSubmissionSchema.safeParse(input);
  if (!parsed.success) return failure('22023');
  try {
    if (!localEnabled()) return failure('disabled');
    await requireCapability('quotations.submit');
    await requireCapability('quotations.view');
    await requireCapability('leads.view');
  } catch {
    return failure('access');
  }
  try {
    const response = await (
      await createSupabaseServerClient()
    ).rpc('crm_submit_quotation_review', { p_input: parsed.data });
    if (response.error) return failure(response.error.code);
    const result = reviewSubmissionResultSchema.safeParse(response.data);
    return result.success ? { status: 'ok', data: result.data } : failure();
  } catch {
    return failure();
  }
}
export async function loadQuotationReview(input: unknown): Promise<Result<QuotationReview>> {
  const parsed = z.object({ id: z.uuid() }).strict().safeParse(input);
  if (!parsed.success) return failure('22023');
  try {
    if (!localEnabled()) return failure('disabled');
    await requireCapability('quotations.view');
  } catch {
    return failure('access');
  }
  try {
    // The request-scoped RPC authorizes the named PM; it does not grant live lead access.
    const response = await (
      await createSupabaseServerClient()
    ).rpc('crm_get_quotation_review', { p_id: parsed.data.id });
    if (response.error) return failure(response.error.code);
    const result = quotationReviewSchema.safeParse(response.data);
    return result.success ? { status: 'ok', data: result.data } : failure();
  } catch {
    return failure();
  }
}

export async function decideQuotationReview(input: unknown): Promise<Result<ReviewDecisionResult>> {
  const parsed = reviewDecisionSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Review the decision details.',
      retryable: false,
    };
  try {
    if (!localEnabled()) return failure('disabled');
    await requireCapability('quotations.view');
    await requireCapability('quotations.approve');
  } catch {
    return failure('access');
  }
  try {
    const response = await (
      await createSupabaseServerClient()
    ).rpc('crm_decide_quotation_review', { p_input: parsed.data });
    if (response.error) return failure(response.error.code);
    const result = reviewDecisionResultSchema.safeParse(response.data);
    return result.success ? { status: 'ok', data: result.data } : failure();
  } catch {
    return failure();
  }
}