'use server';

import { requireCapability } from '@/features/access/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Result } from '@/features/leads/schemas';
import {
  attachmentLinkCommandSchema,
  attachmentLinkQuerySchema,
  attachmentLinkPageSchema,
  attachmentLinkSaveSchema,
  type AttachmentLinkPage,
} from './link-schemas';

function failure(code?: string): Result<never> {
  const messages: Record<string, string> = {
    '42501': 'Your current account cannot access or change this reference.',
    '40001': 'The file, room or visit changed or is read-only. Reload references.',
    '22023': 'Review the target and request ID. Changed input needs a new request ID.',
    '22P02': 'Choose valid reference identifiers.',
    '23514': 'The reference violates a required rule.',
    '23503': 'The reference target is unavailable.',
    '23505': 'This reference already exists. Reload references.',
    PGRST202: 'The attachment-reference migration is unavailable.',
    access: 'Your session or required permission could not be verified.',
  };

  return {
    status: 'error',
    message: messages[code ?? ''] ?? 'The result is unconfirmed. Retry the same reference request.',
    retryable: !messages[code ?? ''],
  };
}

export async function loadAttachmentLinks(input: unknown): Promise<Result<AttachmentLinkPage>> {
  const parsed = attachmentLinkQuerySchema.safeParse(input);

  if (!parsed.success) return failure('22023');

  try {
    await requireCapability('leads.view');
  } catch {
    return failure('access');
  }

  try {
    const client = await createSupabaseServerClient();
    const q = parsed.data;
    const result = await client.rpc('crm_attachment_links', {
      p_lead_id: q.leadId,
      p_attachment_id: q.attachmentId,
      p_kind: q.kind,
      p_target_page: q.targetPage,
      p_link_page: q.page,
    });

    if (result.error) return failure(result.error.code);

    const data = attachmentLinkPageSchema.safeParse(result.data);

    return data.success ? { status: 'ok', data: data.data } : failure();
  } catch {
    return failure();
  }
}

export async function submitAttachmentLink(input: unknown) {
  const parsed = attachmentLinkCommandSchema.safeParse(input);

  if (!parsed.success) return failure('22023');

  try {
    await requireCapability('leads.view');
    await requireCapability(parsed.data.command === 'link' ? 'leads.update' : 'leads.archive');
  } catch {
    return failure('access');
  }

  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_save_attachment_link', {
      p_input: parsed.data,
    });

    if (result.error) return failure(result.error.code);

    const data = attachmentLinkSaveSchema.safeParse(result.data);

    return data.success ? { status: 'ok' as const, data: data.data } : failure();
  } catch {
    return failure();
  }
}