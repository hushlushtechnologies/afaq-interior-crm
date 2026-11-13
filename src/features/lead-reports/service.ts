import 'server-only';
import { requireCapability } from '@/features/access/server';
import type { Result } from '@/features/leads/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { leadReportSchema, reportRangeSchema, type LeadReport, type ReportMode } from './contracts';

export async function loadLeadReport(
  input: unknown,
  mode: ReportMode,
): Promise<Result<LeadReport>> {
  const parsed = reportRangeSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'error',
      message: 'Choose valid From and To dates, in order, covering at most 366 calendar days.',
      retryable: false,
    };
  try {
    await requireCapability(mode === 'dashboard' ? 'dashboard.view' : 'reports.view');
    await requireCapability('leads.view');
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc('crm_lead_report', {
      p_from: parsed.data.from,
      p_to: parsed.data.to,
      p_mode: mode,
    });
    if (error?.code === '42501')
      return {
        status: 'error',
        message: 'Your current account cannot view lead metrics.',
        retryable: false,
      };
    const result = leadReportSchema.safeParse(data);
    if (!error && result.success) return { status: 'ok', data: result.data };
  } catch {
    // Never expose database diagnostics, credentials or customer data in errors.
  }
  return {
    status: 'error',
    message: 'Lead metrics could not be verified. Apply the dates again to retry.',
    retryable: true,
  };
}