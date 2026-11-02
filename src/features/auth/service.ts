import 'server-only';

import { isAuthServiceFailure } from '@/features/auth/errors';
import type { SignInValues } from '@/features/auth/schemas';
import { createSupabaseMutationClient } from '@/lib/supabase/server';

type SignInResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'denied' | 'rate-limited' | 'unavailable';
    };

function reportAuthFailure(stage: string, error: unknown) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const details =
    typeof error === 'object' && error !== null
      ? (error as {
          name?: unknown;
          code?: unknown;
          status?: unknown;
        })
      : {};

  console.error('AFAQ_AUTH_DIAGNOSTIC', {
    stage,
    name: typeof details.name === 'string' ? details.name : 'UnknownError',
    code: typeof details.code === 'string' ? details.code : null,
    status: typeof details.status === 'number' ? details.status : null,
  });
}

export async function signInWithCredentials(values: SignInValues): Promise<SignInResult> {
  let stage = 'create-client';

  try {
    const supabase = await createSupabaseMutationClient();

    stage = 'password-sign-in';

    const { data, error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      reportAuthFailure(stage, error);

      if (error.status === 429) {
        return {
          ok: false,
          reason: 'rate-limited',
        };
      }

      return {
        ok: false,
        reason: isAuthServiceFailure(error) ? 'unavailable' : 'denied',
      };
    }

    if (!data.session || !data.user?.email || !data.user.email_confirmed_at) {
      reportAuthFailure('verify-sign-in-result', {
        name: 'IncompleteSignIn',
        code: !data.session
          ? 'session_missing'
          : !data.user?.email
            ? 'email_missing'
            : 'email_not_confirmed',
      });

      await supabase.auth.signOut({
        scope: 'local',
      });

      return {
        ok: false,
        reason: 'denied',
      };
    }

    return {
      ok: true,
    };
  } catch (error) {
    reportAuthFailure(stage, error);

    return {
      ok: false,
      reason: 'unavailable',
    };
  }
}

export async function signOutCurrentSession(): Promise<{
  ok: boolean;
}> {
  try {
    const supabase = await createSupabaseMutationClient();

    const { error } = await supabase.auth.signOut({
      scope: 'local',
    });

    if (error) {
      reportAuthFailure('sign-out', error);
    }

    return {
      ok: !error,
    };
  } catch (error) {
    reportAuthFailure('sign-out', error);

    return {
      ok: false,
    };
  }
}
