'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  emailLinkSchema,
  passwordUpdateSchema,
  recoveryRequestSchema,
} from '@/features/auth/recovery-schemas';
import {
  requestPasswordRecovery,
  updateOwnPassword,
  verifyEmailLink,
} from '@/features/auth/recovery-service';
import type {
  EmailLinkState,
  PasswordUpdateState,
  RecoveryRequestState,
} from '@/features/auth/recovery-types';

export async function requestRecoveryAction(
  _previousState: RecoveryRequestState,
  input: unknown,
): Promise<RecoveryRequestState> {
  const parsed = recoveryRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: 'invalid',
      message: null,
      fieldError: parsed.error.flatten().fieldErrors.email?.[0],
    };
  }

  const result = await requestPasswordRecovery(parsed.data.email);

  if (result === 'unavailable') {
    return {
      status: 'error',
      message: 'Password recovery is temporarily unavailable. Please try again shortly.',
    };
  }

  return {
    status: 'submitted',
    message:
      'If an eligible account uses that email address, recovery instructions will arrive. Check your inbox and wait a minute before trying again.',
  };
}

export async function confirmEmailLinkAction(
  _previousState: EmailLinkState,
  input: unknown,
): Promise<EmailLinkState> {
  const parsed = emailLinkSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'This link is invalid or incomplete. Request a new email.',
    };
  }

  const result = await verifyEmailLink(parsed.data);

  if (result.status === 'verified') {
    revalidatePath('/', 'layout');

    if (result.type === 'recovery') {
      redirect('/auth/update-password');
    }

    redirect('/dashboard');
  }

  return {
    status: 'error',
    message:
      result.status === 'unavailable'
        ? 'The authentication service is temporarily unavailable. Try Continue again shortly.'
        : 'This link is invalid, expired, or already used. Request a new email.',
  };
}

export async function updatePasswordAction(
  _previousState: PasswordUpdateState,
  input: unknown,
): Promise<PasswordUpdateState> {
  const parsed = passwordUpdateSchema.safeParse(input);

  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;

    return {
      status: 'invalid',
      message: null,
      fieldErrors: {
        password: fields.password?.[0],
        confirmPassword: fields.confirmPassword?.[0],
      },
    };
  }

  const result = await updateOwnPassword(parsed.data.password);

  if (result.status === 'rejected') {
    const messages = {
      'session-required': 'Request a new recovery link and open it before changing your password.',
      'same-password': 'Choose a password different from your current password.',
      'weak-password': 'Choose a stronger password with at least 12 characters.',
      'rate-limited': 'Too many attempts. Wait a little and try again.',
      unavailable: 'Your password could not be updated. Please try again shortly.',
    };

    return {
      status: 'error',
      message: messages[result.reason],
      fieldErrors: {},
    };
  }

  revalidatePath('/', 'layout');

  if (!result.signedOut) {
    return {
      status: 'updated',
      message: 'Your password was updated. Sign out below to finish.',
      fieldErrors: {},
    };
  }

  redirect('/login');
}
