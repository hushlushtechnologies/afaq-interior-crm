'use server';

import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { visitQuerySchema, visitCommandSchema, type VisitPage, type VisitSave } from './schemas';
import { fetchSiteVisits, saveSiteVisit } from './service';
const denied = {
  status: 'error',
  message: 'Your session or lead permission could not be verified.',
  retryable: false,
} as const;
export async function loadSiteVisits(input: unknown): Promise<Result<VisitPage>> {
  const parsed = visitQuerySchema.safeParse(input);
  if (!parsed.success)
    return { status: 'error', message: 'Choose a valid lead and visit page.', retryable: false };
  try {
    await requireCapability('leads.view');
  } catch {
    return denied;
  }
  return fetchSiteVisits(parsed.data);
}
export async function submitSiteVisit(input: unknown): Promise<Result<VisitSave>> {
  const parsed = visitCommandSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Review the visit fields, time, outcome or cancellation reason.',
      retryable: false,
    };
  try {
    await requireCapability('leads.view');
    await requireCapability('leads.update');
  } catch {
    return denied;
  }
  return saveSiteVisit(parsed.data);
}
