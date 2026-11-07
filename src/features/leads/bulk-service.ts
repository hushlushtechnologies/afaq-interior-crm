import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bulkResultSchema, type BulkAssignment, type BulkResult } from './bulk-schemas';
import type { Result } from './schemas';

export async function bulkAssignLeads(input: BulkAssignment): Promise<Result<BulkResult>> {
  try {
    const client = await createSupabaseServerClient();

    const result = await client.rpc('crm_bulk_assign_leads', {
      p_request_id: input.requestId,
      p_rows: input.rows,
      p_owner: input.owner,
    });

    if (result.error) {
      const messages: Record<string, string> = {
        '42501': 'You cannot assign every lead in this selection. Reload your current access.',
        '40001':
          'A selected lead changed, is Lost or was archived. Reload and select again. Nothing in this batch was assigned.',
        '22023':
          'Review the selection and eligible owner. Assigned leads cannot be unassigned. Nothing in this batch was assigned.',
      };

      return {
        status: 'error',
        message:
          messages[result.error.code] ??
          'The result could not be confirmed. Retry the same bulk request.',
        retryable: !messages[result.error.code],
      };
    }

    const parsed = bulkResultSchema.safeParse(result.data);
    if (parsed.success) return { status: 'ok', data: parsed.data };
  } catch {
    /* Preserve the request identity when the outcome is uncertain. */
  }

  return {
    status: 'error',
    message: 'The result could not be confirmed. Retry the same bulk request.',
    retryable: true,
  };
}
