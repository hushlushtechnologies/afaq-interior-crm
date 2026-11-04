'use server';

import { revalidatePath } from 'next/cache';
import { AccessDeniedError, requireCapability } from '@/features/access/server';
import { getAuthState } from '@/features/auth/session';
import {
  invitationRequestSchema,
  type InvitationActionState,
} from '@/features/employee/invitation-request';
import { requestEmployeeInvitation } from '@/features/employee/invitation-service';
import { createSupabaseMutationClient } from '@/lib/supabase/server';

export async function requestEmployeeInvitationAction(
  input: unknown,
): Promise<InvitationActionState> {
  const auth = await getAuthState();

  if (auth.status === 'anonymous') {
    return {
      status: 'unauthenticated',
      message: 'Sign in again to continue.',
    };
  }

  if (auth.status === 'unavailable') {
    return {
      status: 'error',
      message: 'Authentication could not be verified.',
    };
  }

  try {
    const access = await requireCapability('access.roles.manage', 'company');

    if (!access.roles.includes('super_admin')) {
      return {
        status: 'denied',
        message: 'Only Super Admin can request employee invitations.',
      };
    }
  } catch (error) {
    return error instanceof AccessDeniedError
      ? {
          status: 'denied',
          message: 'Only Super Admin can request employee invitations.',
        }
      : {
          status: 'error',
          message: 'Invitation authority could not be verified.',
        };
  }

  const parsed = invitationRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: 'invalid',
      message: 'Enter a valid name, work email, and request ID.',
    };
  }

  let result: Awaited<ReturnType<typeof requestEmployeeInvitation>>;

  try {
    result = await requestEmployeeInvitation(
      await createSupabaseMutationClient(),
      parsed.data,
    );
  } catch {
    return {
      status: 'error',
      message: 'The result could not be confirmed. Retry unchanged input with the same request ID.',
    };
  }

  if (result.status !== 'ok') {
    return {
      status: result.status,
      message:
        result.status === 'denied'
          ? 'Invitation authority is no longer available.'
          : result.status === 'conflict'
            ? 'This request ID was already used for different input. Start a new request.'
            : 'The result could not be confirmed. Retry unchanged input with the same request ID.',
    };
  }

  revalidatePath('/employees/invitations');

  return {
    status: 'ok',
    result: result.result,
    message:
      result.result.status === 'queued'
        ? 'Invitation request recorded. No email has been sent.'
        : result.result.status === 'already_pending'
          ? 'An invitation request is already pending for this email.'
          : 'An authentication account already exists. No invitation was created.',
  };
}