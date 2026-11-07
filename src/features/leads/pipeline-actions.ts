'use server';

import { z } from 'zod';
import { requireCapability } from '@/features/access/server';
import { pipelineCommandSchema, type PipelineDetail } from './pipeline-schemas';
import { fetchPipelineDetail, transitionLead } from './pipeline-service';
import type { LeadSave, Result } from './schemas';

const denied = {
  status: 'error',
  message: 'Your session or pipeline permission could not be verified. Reload or sign in again.',
  retryable: false,
} as const;

export async function submitPipeline(input: unknown): Promise<Result<LeadSave>> {
  const parsed = pipelineCommandSchema.safeParse(input);

  if (!parsed.success)
    return {
      status: 'error',
      message: 'Review the working stage, Lost details or reopening reason.',
      retryable: false,
    };

  try {
    await requireCapability(parsed.data.command === 'move' ? 'leads.update' : 'leads.mark_lost');
  } catch {
    return denied;
  }

  return transitionLead(parsed.data);
}

export async function loadPipelineDetail(input: unknown): Promise<Result<PipelineDetail>> {
  const parsed = z.uuid().safeParse(input);

  if (!parsed.success)
    return { status: 'error', message: 'Choose a valid lead.', retryable: false };

  try {
    await requireCapability('leads.view');
  } catch {
    return denied;
  }

  return fetchPipelineDetail(parsed.data);
}
