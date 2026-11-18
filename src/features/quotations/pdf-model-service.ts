import 'server-only';

import { z } from 'zod';
import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createDraftQuotationPdfModel, type DraftQuotationPdfModel } from './pdf-model';

const querySchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().min(1).max(2147483647),
  })
  .strict();

/** Internal server service, not a public Server Action or download endpoint. */
export async function loadDraftQuotationPdfModel(
  input: unknown,
): Promise<Result<DraftQuotationPdfModel>> {
  const query = querySchema.safeParse(input);

  if (!query.success)
    return {
      status: 'error',
      message: 'Choose a valid quotation and saved version.',
      retryable: false,
    };

  try {
    await requireCapability('quotations.view');

    const client = await createSupabaseServerClient();

    // Both RPCs recheck current resource visibility through the existing RBAC engine.
    const [record, snapshot] = await Promise.all([
      client.rpc('crm_get_quotation', {
        p_id: query.data.id,
      }),
      client.rpc('crm_quotation_snapshot', {
        p_id: query.data.id,
        p_version: query.data.version,
      }),
    ]);

    if (!record.error && !snapshot.error)
      return {
        status: 'ok',
        data: createDraftQuotationPdfModel(record.data, snapshot.data),
      };
  } catch {
    // Do not log customer data, saved notes or financial snapshots.
  }

  return {
    status: 'error',
    message: 'The draft document data could not be verified or access is no longer permitted.',
    retryable: true,
  };
}