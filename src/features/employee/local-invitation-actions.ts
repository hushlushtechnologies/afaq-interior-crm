'use server';

import { z } from 'zod';
import { createSupabaseMutationClient } from '@/lib/supabase/server';
import { passwordUpdateSchema } from '@/features/auth/recovery-schemas';
import {
  createLocalInvitationAdmin,
  getLocalInvitationSettings,
} from '@/features/employee/local-invitation';

export async function deliverLocalInvitation(input: unknown): Promise<string> {
  const parsed = z.string().uuid().safeParse(input);
  if (!parsed.success) return 'Choose a valid invitation.';

  try {
    const { origin } = getLocalInvitationSettings();
    // Initialize all prerequisites before claiming the attempt.
    const admin = createLocalInvitationAdmin();
    const client = await createSupabaseMutationClient();

    const { data, error } = await client.rpc('crm_claim_local_employee_invitation', {
      p_id: parsed.data,
    });

    if (error) return 'Delivery is not permitted or the local test invitation is unavailable.';
    if (data.status === 'account_exists') return 'An account already exists. No email was sent.';
    if (data.status === 'delivered' || data.status === 'accepted')
      return 'Local invitation already delivered. No second email was sent.';
    if (data.status === 'busy') return 'Delivery is in progress. Check again after one minute.';
    if (!['send', 'check'].includes(data.status) || !data.attemptId)
      return 'Delivery could not be confirmed.';

    let confirmed = false;

    if (data.status === 'send') {
      try {
        const invited = await admin.auth.admin.inviteUserByEmail(data.email, {
          redirectTo: `${origin}/auth/accept-invitation`,
        });
        confirmed = !invited.error && Boolean(invited.data.user);
      } catch {
        // A timeout does not prove that Auth failed to create/send the invitation.
      }
    }

    const reconciled = await admin.rpc('crm_reconcile_local_employee_invitation', {
      p_id: parsed.data,
      p_attempt: data.attemptId,
      p_confirmed: confirmed,
    });

    if (!reconciled.error && ['delivered', 'accepted'].includes(reconciled.data)) {
      return 'Local invitation delivered. Open the local email viewer to continue.';
    }

    return 'Delivery is uncertain. Check again; this action will not automatically resend an email.';
  } catch {
    return 'Local delivery is disabled or unavailable. No automatic resend was attempted.';
  }
}

export async function verifyLocalInvitation(input: unknown): Promise<string | null> {
  const token = z.string().regex(/^[A-Za-z0-9_-]{16,512}$/);

  const parsed = z
    .union([
      token.transform((tokenHash) => ({ tokenHash, type: 'invite' as const })),
      z.object({ tokenHash: token, type: z.enum(['invite', 'recovery']) }).strict(),
    ])
    .safeParse(input);

  if (!parsed.success) return 'This invitation is invalid, expired, or already used.';

  try {
    getLocalInvitationSettings();
    const client = await createSupabaseMutationClient();

    const verified = await client.auth.verifyOtp({
      token_hash: parsed.data.tokenHash,
      type: parsed.data.type,
    });

    if (verified.error || !verified.data.session)
      return 'This invitation is invalid, expired, or already used.';

    const own = await client.rpc('crm_get_my_employee_invitation');

    if (own.error || own.data !== 'delivered') {
      await client.auth.signOut({ scope: 'local' });
      return 'The invitation identity could not be confirmed. Ask the administrator to check delivery.';
    }

    return null;
  } catch {
    return 'The invitation could not be verified. Please try again.';
  }
}

export async function acceptLocalInvitation(input: unknown): Promise<string | null> {
  const parsed = passwordUpdateSchema.safeParse(input);

  if (!parsed.success)
    return 'Use matching passwords with at least 12 characters and at most 72 bytes.';

  try {
    getLocalInvitationSettings();
    const client = await createSupabaseMutationClient();
    const own = await client.rpc('crm_get_my_employee_invitation');

    if (own.error || !['delivered', 'accepted'].includes(own.data))
      return 'A verified employee invitation is required.';

    if (own.data !== 'accepted') {
      const password = await client.auth.updateUser({ password: parsed.data.password });

      if (password.error && password.error.code !== 'same_password')
        return 'The password could not be set. Try again with a strong matching password.';

      const accepted = await client.rpc('crm_accept_employee_invitation');

      if (accepted.error) return 'Completion could not be confirmed. Retry with the same password.';
    }

    const logout = await client.auth.signOut({ scope: 'local' });

    return logout.error ? 'Acceptance completed. Please sign out before signing in again.' : null;
  } catch {
    return 'Completion could not be confirmed. Retry with the same password.';
  }
}
