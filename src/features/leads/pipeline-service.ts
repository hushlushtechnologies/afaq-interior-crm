import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { leadSaveSchema, type LeadSave, type Result } from './schemas';
import {
  pipelineDetailSchema,
  type PipelineCommand,
  type PipelineDetail,
} from './pipeline-schemas';

function failure(code?: string): Result<never> {
  const messages: Record<string, string> = {
    '42501': 'Your current account cannot perform this pipeline operation.',
    '40001': 'The lead changed, is closed or was archived. Reload and review it.',
    '22023': 'Review the stage, eligible owner, Lost reason or reopening explanation.',
    '23514': 'The pipeline request violates a protected business rule.',
  };

  return {
    status: 'error',
    message: messages[code ?? ''] ?? 'The result could not be confirmed. Retry the same request.',
    retryable: !messages[code ?? ''],
  };
}

export async function transitionLead(command: PipelineCommand): Promise<Result<LeadSave>> {
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_transition_lead', {
      p_request_id: command.requestId,
      p_lead_id: command.leadId,
      p_version: command.version,
      p_command: command.command,
      p_data: command.data,
    });

    if (result.error) return failure(result.error.code);

    const parsed = leadSaveSchema.safeParse(result.data);
    return parsed.success ? { status: 'ok', data: parsed.data } : failure();
  } catch {
    return failure();
  }
}

export async function fetchPipelineDetail(id: string): Promise<Result<PipelineDetail>> {
  try {
    const client = await createSupabaseServerClient();
    const result = await client.rpc('crm_pipeline_detail', { p_lead_id: id });

    if (result.error) return failure(result.error.code);

    const parsed = pipelineDetailSchema.safeParse(result.data);
    if (parsed.success) return { status: 'ok', data: parsed.data };
  } catch {
    // Do not expose raw database errors or customer records in errors.
  }

  return {
    status: 'error',
    message: 'Pipeline history could not be loaded. Try again.',
    retryable: true,
  };
}
