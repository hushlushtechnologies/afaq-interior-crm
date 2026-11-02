'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { emailCodeSchema, verificationRequestSchema } from '@/features/auth/verification-schemas';
import { requestEmailVerification, verifyEmailCode } from '@/features/auth/verification-service';
import type { EmailCodeState, VerificationRequestState } from '@/features/auth/verification-types';

export async function requestVerificationAction(
  _previousState: VerificationRequestState,
  input: unknown,
): Promise<VerificationRequestState> {
  const parsed = verificationRequestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: 'invalid',
      message: null,
      fieldError: parsed.error.flatten().fieldErrors.email?.[0],
    };
  }

  const result = await requestEmailVerification(parsed.data.email);

  if (result === 'unavailable') {
    return {
      status: 'error',
      message: 'Email verification is temporarily unavailable. Please try again shortly.',
    };
  }

  return {
    status: 'submitted',
    message:
      'If an eligible account needs email verification, instructions will arrive. Check your inbox and wait a minute before requesting again.',
  };
}

export async function verifyEmailCodeAction(
  _previousState: EmailCodeState,
  input: unknown,
): Promise<EmailCodeState> {
  const parsed = emailCodeSchema.safeParse(input);

  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;

    return {
      status: 'invalid',
      message: null,
      fieldErrors: {
        email: fields.email?.[0],
        token: fields.token?.[0],
      },
    };
  }

  const result = await verifyEmailCode(parsed.data);

  if (result === 'verified') {
    revalidatePath('/', 'layout');
    redirect('/dashboard');
  }

  const messages = {
    invalid: 'The code is invalid or expired. Request a new verification email.',
    'rate-limited': 'Too many verification attempts. Wait a little and try again.',
    unavailable: 'The authentication service is temporarily unavailable. Please try again shortly.',
  };

  return {
    status: 'error',
    message: messages[result],
    fieldErrors: {},
  };
}
