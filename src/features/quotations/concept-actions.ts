'use server';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getApplicationOrigin } from '@/lib/supabase/server-config';
import { downloadLocalAttachment } from '@/features/lead-attachments/local-service';
import {
  conceptWorkspaceQuerySchema,
  conceptWorkspaceSchema,
  conceptPreviewQuerySchema,
  conceptPreviewTargetSchema,
  type ConceptWorkspace,
} from './concept-ui-contracts';
import {
  conceptCommandSchema,
  conceptQuerySchema,
  conceptSavedSchema,
  conceptPageSchema,
  type ConceptPage,
  type ConceptSaved,
} from './concept-contracts';

function localEnabled() {
  if (
    process.env.ENABLE_LOCAL_QUOTATION_CONCEPTS !== 'true' ||
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
    disabled: 'Local concept references are disabled.',
    access: 'Your session or required quotation/lead permission could not be verified.',
    '42501': 'Concept access or changes are no longer permitted.',
    '40001': 'The concept changed or is read-only. Reload before retrying.',
    '22023': 'Review the image, room, revision and retry identifiers.',
    '23505': 'This image is already registered in this revision. Reload references.',
    '23514': 'The concept reference violates a required rule.',
    '23503': 'The quotation, source image or revision is unavailable.',
    PGRST202: 'The concept-reference migration is unavailable.',
  };
  return {
    status: 'error',
    message: messages[code ?? ''] ?? 'The result is unconfirmed. Retry the same request.',
    retryable: !messages[code ?? ''],
  };
}
export async function loadQuotationConcepts(input: unknown): Promise<Result<ConceptPage>> {
  const parsed = conceptQuerySchema.safeParse(input);
  if (!parsed.success) return failure('22023');
  try {
    if (!localEnabled()) return failure('disabled');
    await requireCapability('quotations.view');
    await requireCapability('leads.view');
  } catch {
    return failure('access');
  }
  try {
    const client = await createSupabaseServerClient();
    const q = parsed.data;
    const response = await client.rpc('crm_quotation_concepts', {
      p_id: q.id,
      p_revision: q.revision,
      p_page: q.page,
      p_archived: q.archived,
    });
    if (response.error) return failure(response.error.code);
    const result = conceptPageSchema.safeParse(response.data);
    return result.success ? { status: 'ok', data: result.data } : failure();
  } catch {
    return failure();
  }
}
export async function submitQuotationConcept(input: unknown): Promise<Result<ConceptSaved>> {
  const parsed = conceptCommandSchema.safeParse(input);
  if (!parsed.success) return failure('22023');
  try {
    if (!localEnabled()) return failure('disabled');
    await requireCapability('quotations.view');
    await requireCapability('leads.view');
    await requireCapability('quotations.update');
  } catch {
    return failure('access');
  }
  try {
    const client = await createSupabaseServerClient();
    const response = await client.rpc('crm_save_quotation_concept', { p_input: parsed.data });
    if (response.error) return failure(response.error.code);
    const result = conceptSavedSchema.safeParse(response.data);
    return result.success ? { status: 'ok', data: result.data } : failure();
  } catch {
    return failure();
  }
}

export async function loadConceptWorkspace(input: unknown): Promise<Result<ConceptWorkspace>> {
  const parsed = conceptWorkspaceQuerySchema.safeParse(input);
  if (!parsed.success) return failure('22023');
  try {
    if (!localEnabled()) return failure('disabled');
    await requireCapability('quotations.view');
    await requireCapability('leads.view');
    const client = await createSupabaseServerClient();
    const q = parsed.data;
    const [references, context] = await Promise.all([
      client.rpc('crm_quotation_concepts', {
        p_id: q.id,
        p_revision: q.revision,
        p_page: q.page,
        p_archived: q.archived,
      }),
      client.rpc('crm_quotation_concept_context', {
        p_id: q.id,
        p_revision: q.revision,
        p_image_page: q.imagePage,
      }),
    ]);
    if (references.error || context.error)
      return failure(references.error?.code ?? context.error?.code);
    const result = conceptWorkspaceSchema.safeParse({
      references: references.data,
      context: context.data,
    });
    return result.success ? { status: 'ok', data: result.data } : failure();
  } catch {
    return failure();
  }
}

export async function previewQuotationConcept(
  input: unknown,
): Promise<Result<{ url: string; expiresAt: number }>> {
  const parsed = conceptPreviewQuerySchema.safeParse(input);
  if (!parsed.success) return failure('22023');
  try {
    if (!localEnabled()) return failure('disabled');
    await requireCapability('quotations.view');
    await requireCapability('leads.view');
    const client = await createSupabaseServerClient();
    const args = { p_id: parsed.data.id, p_reference: parsed.data.referenceId };
    const before = await client.rpc('crm_quotation_concept_preview', args);
    if (before.error) return failure(before.error.code);
    const source = conceptPreviewTargetSchema.parse(before.data);
    const expiresAt = Date.now() + 60000;
    const access = await downloadLocalAttachment({
      leadId: source.leadId,
      attachmentId: source.attachmentId,
    });
    const after = await client.rpc('crm_quotation_concept_preview', args);
    if (after.error) return failure(after.error.code);
    const confirmed = conceptPreviewTargetSchema.parse(after.data);
    if (JSON.stringify(confirmed) !== JSON.stringify(source)) return failure('40001');
    const url = new URL(access.url);
    if (
      url.origin !== 'http://127.0.0.1:57421' ||
      !url.pathname.startsWith('/storage/v1/object/sign/crm-private/')
    )
      return failure();
    return { status: 'ok', data: { url: url.href, expiresAt } };
  } catch {
    return failure();
  }
}