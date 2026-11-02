import 'server-only';

import { isAuthServiceFailure } from '@/features/auth/errors';
import { reportAuthFlowFailure } from '@/features/auth/flow-diagnostics';
import type { EmailCodeValues } from '@/features/auth/verification-schemas';
import { createSupabaseMutationClient } from '@/lib/supabase/server';
import { getApplicationOrigin } from '@/lib/supabase/server-config';

type VerificationRequestResult = 'accepted' | 'unavailable';

type EmailCodeResult = 'verified' | 'invalid' | 'rate-limited' | 'unavailable';

export async function requestEmailVerification(email: string): Promise<VerificationRequestResult> {
  try {
    const supabase = await createSupabaseMutationClient();

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${getApplicationOrigin()}/auth/confirm`,
      },
    });

    if (error) {
      reportAuthFlowFailure('request-email-verification', error);

      if (
        isAuthServiceFailure(error) ||
        error.status === 401 ||
        error.code === 'email_provider_disabled'
      ) {
        return 'unavailable';
      }

      // Do not reveal whether an account exists or is confirmed.
      return 'accepted';
    }

    return 'accepted';
  } catch (error) {
    reportAuthFlowFailure('request-email-verification', error);

    return 'unavailable';
  }
}

export async function verifyEmailCode(values: EmailCodeValues): Promise<EmailCodeResult> {
  try {
    const supabase = await createSupabaseMutationClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email: values.email,
      token: values.token,
      type: 'email',
    });

    if (error) {
      reportAuthFlowFailure('verify-email-code', error);

      if (error.status === 429) {
        return 'rate-limited';
      }

      return isAuthServiceFailure(error) ? 'unavailable' : 'invalid';
    }

    if (!data.session || !data.user?.email || !data.user.email_confirmed_at) {
      await supabase.auth.signOut({
        scope: 'local',
      });

      return 'invalid';
    }

    return 'verified';
  } catch (error) {
    reportAuthFlowFailure('verify-email-code', error);

    return 'unavailable';
  }
}
