'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signInSchema, type SignInValues } from '@/features/auth/schemas';
import { signInWithCredentials, signOutCurrentSession } from '@/features/auth/service';
import type { SignInActionState, SignOutActionState } from '@/features/auth/types';

export async function signInAction(
  _previousState: SignInActionState,
  values: SignInValues,
): Promise<SignInActionState> {
  const parsed = signInSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: 'invalid',
      message: null,
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  const result = await signInWithCredentials(parsed.data);

  if (!result.ok) {
    const messages = {
      denied: 'Check your email, password, and email verification.',
      'rate-limited': 'Too many sign-in attempts. Wait a little and try again.',
      unavailable: 'The authentication service is temporarily unavailable. Try again shortly.',
    };

    return {
      status: 'error',
      message: messages[result.reason],
      fieldErrors: {},
    };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOutAction(): Promise<SignOutActionState> {
  const result = await signOutCurrentSession();

  if (!result.ok) {
    return {
      status: 'error',
      message: 'Sign-out could not be completed. Please try again.',
    };
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}
