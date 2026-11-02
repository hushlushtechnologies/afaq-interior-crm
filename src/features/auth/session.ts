import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { isAuthServiceFailure } from '@/features/auth/errors';
import type { AuthState } from '@/features/auth/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const getAuthState = cache(async (): Promise<AuthState> => {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return {
        status: isAuthServiceFailure(error) ? 'unavailable' : 'anonymous',
      };
    }

    if (!data.user?.email || !data.user.email_confirmed_at) {
      return {
        status: 'anonymous',
      };
    }

    return {
      status: 'authenticated',
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    };
  } catch {
    return {
      status: 'unavailable',
    };
  }
});

export async function requireAuthenticatedUser() {
  const state = await getAuthState();

  if (state.status === 'unavailable') {
    throw new Error('Authentication verification is temporarily unavailable.');
  }

  if (state.status === 'anonymous') {
    redirect('/login');
  }

  return state.user;
}
