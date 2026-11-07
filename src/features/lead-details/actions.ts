'use server';

import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { detailQuerySchema, type DetailPage, type DetailSave } from './contracts';
import { detailCommandSchema } from './schemas';
import { fetchLeadDetails, saveLeadDetail } from './service';

const denied = {
  status: 'error',
  message: 'Your session or lead permission could not be verified. Reload or sign in again.',
  retryable: false,
} as const;

export async function loadLeadDetails(input: unknown): Promise<Result<DetailPage>> {
  const parsed = detailQuerySchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Choose a valid lead, detail type and page.',
      retryable: false,
    };
  try {
    await requireCapability('leads.view');
  } catch {
    return denied;
  }
  return fetchLeadDetails(parsed.data);
}

export async function submitLeadDetail(input: unknown): Promise<Result<DetailSave>> {
  const parsed = detailCommandSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Check the detail fields, dates and record version.',
      retryable: false,
    };
  try {
    await requireCapability('leads.view');
    await requireCapability('leads.update');
  } catch {
    return denied;
  }
  return saveLeadDetail(parsed.data);
}