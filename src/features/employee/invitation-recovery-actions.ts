'use server';

import { z } from 'zod';
import { createSupabaseMutationClient } from '@/lib/supabase/server';
import {
  createLocalInvitationAdmin,
  getLocalInvitationSettings,
} from '@/features/employee/local-invitation';

const infoSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  events: z.array(z.object({ event: z.string(), at: z.string(), actor: z.string() })).max(20),
});

export type RecoveryInfo = z.infer<typeof infoSchema>;

export async function findLocalInvitation(input: unknown): Promise<RecoveryInfo | null> {
  const email = z.string().trim().email().max(254).safeParse(input);
  if (!email.success) return null;

  try {
    getLocalInvitationSettings();
    const client = await createSupabaseMutationClient();
    const result = await client.rpc('crm_find_local_invitation', { p_email: email.data });
    const parsed = infoSchema.safeParse(result.data);
    return !result.error && parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function replaceLocalInvitation(
  input: unknown,
): Promise<{ done: boolean; message: string }> {
  const parsed = z
    .object({
      invitationId: z.string().uuid(),
      requestId: z.string().uuid(),
      reviewed: z.literal(true),
    })
    .strict()
    .safeParse(input);

  if (!parsed.success)
    return {
      done: false,
      message: 'Review the local email viewer and confirm the replacement first.',
    };

  try {
    const { origin } = getLocalInvitationSettings();
    const admin = createLocalInvitationAdmin();
    const client = await createSupabaseMutationClient();

    const claim = await client.rpc('crm_prepare_local_invitation_recovery', {
      p_id: parsed.data.invitationId,
      p_request_id: parsed.data.requestId,
      p_reviewed: true,
    });

    if (claim.error)
      return {
        done: false,
        message: 'Replacement is not permitted or this invitation requires identity review.',
      };

    const data = claim.data;

    if (['delivered', 'accepted', 'superseded'].includes(data.status))
      return {
        done: true,
        message:
          'This replacement was already processed or superseded. Refresh the invitation history.',
      };

    if (data.status === 'busy')
      return {
        done: false,
        message:
          'Wait at least one minute after the previous delivery attempt, then retry this confirmation.',
      };

    if (data.status === 'not_started')
      return {
        done: false,
        message: 'Use the initial delivery button before requesting a replacement.',
      };

    let confirmed = false;

    if (data.status === 'send') {
      try {
        const options = { redirectTo: `${origin}/auth/accept-invitation` };

        if (data.kind === 'recovery') {
          confirmed = !(await admin.auth.resetPasswordForEmail(data.email, options)).error;
        } else {
          const sent = await admin.auth.admin.inviteUserByEmail(data.email, options);
          confirmed = !sent.error && Boolean(sent.data.user);
        }
      } catch {
        /* Reconcile instead of automatically sending again. */
      }
    } else if (data.status !== 'check')
      return { done: false, message: 'The recovery result could not be verified.' };

    const result = await admin.rpc('crm_reconcile_local_employee_invitation', {
      p_id: parsed.data.invitationId,
      p_attempt: data.attemptId,
      p_confirmed: confirmed,
    });

    return !result.error && ['delivered', 'accepted'].includes(result.data)
      ? {
          done: true,
          message:
            'Replacement link delivered to the local email viewer. The Auth identity and existing roles were preserved.',
        }
      : {
          done: false,
          message:
            'Delivery is uncertain. Retry this confirmation to check it; it will not automatically send again.',
        };
  } catch {
    return {
      done: false,
      message: 'The result could not be confirmed. Retry this same confirmation.',
    };
  }
}
