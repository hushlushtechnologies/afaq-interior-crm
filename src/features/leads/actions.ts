'use server';

import { requireCapability } from '@/features/access/server';
import {
  leadCommandSchema,
  leadQuerySchema,
  type LeadOptions,
  type LeadPage,
  type LeadSave,
  type Result,
} from './schemas';
import { fetchLeadOptions, fetchLeadPage, saveLead } from './service';

const denied = {
  status: 'error',
  message: 'Your session or lead permission could not be verified. Reload or sign in again.',
  retryable: false,
} as const;

export async function loadLeads(input: unknown): Promise<Result<LeadPage>> {
  const parsed = leadQuerySchema.safeParse(input);
  if (!parsed.success)
    return { status: 'error', message: 'Choose a valid lead page.', retryable: false };

  try {
    await requireCapability('leads.view');
  } catch {
    return denied;
  }

  return fetchLeadPage(parsed.data);
}

export async function loadLeadOptions(): Promise<Result<LeadOptions>> {
  try {
    await requireCapability('leads.view');
  } catch {
    return denied;
  }

  return fetchLeadOptions();
}

export async function submitLead(input: unknown): Promise<Result<LeadSave>> {
  const parsed = leadCommandSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Check the lead details, dates, contact information and budget.',
      retryable: false,
    };

  try {
    const permissions = {
      create: 'leads.create',
      update: 'leads.update',
      assign: 'leads.assign',
      archive: 'leads.archive',
    } as const;

    await requireCapability(permissions[parsed.data.command]);
  } catch {
    return denied;
  }

  return saveLead(parsed.data);
}
