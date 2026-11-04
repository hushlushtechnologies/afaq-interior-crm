import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  invitationResultSchema,
  type InvitationRequest,
  type InvitationResult,
} from '@/features/employee/invitation-request';

type RequestResult =
  { status: 'ok'; result: InvitationResult } | { status: 'denied' | 'conflict' | 'error' };

// Use the request-scoped session client, never a service-role client.
export async function requestEmployeeInvitation(
  client: SupabaseClient,
  input: InvitationRequest,
): Promise<RequestResult> {
  try {
    const { data, error } = await client.rpc('crm_request_employee_invitation', {
      p_request_id: input.requestId,
      p_display_name: input.displayName,
      p_work_email: input.workEmail,
    });

    if (error) {
      return {
        status: error.code === '42501' ? 'denied' : error.code === '22023' ? 'conflict' : 'error',
      };
    }

    const parsed = invitationResultSchema.safeParse(data);

    return parsed.success ? { status: 'ok', result: parsed.data } : { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}
