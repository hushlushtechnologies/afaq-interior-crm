import 'server-only';

import { isAuthServiceFailure } from '@/features/auth/errors';
import { reportAuthFlowFailure } from '@/features/auth/flow-diagnostics';
import type { EmailLinkValues } from '@/features/auth/recovery-schemas';
import { createSupabaseMutationClient } from '@/lib/supabase/server';
import { getApplicationOrigin } from '@/lib/supabase/server-config';

type RecoveryRequestResult = 'accepted' | 'unavailable';

type EmailLinkResult =
  | {
      status: 'verified';
      type: EmailLinkValues['type'];
    }
  | {
      status: 'invalid' | 'unavailable';
    };

type PasswordUpdateResult =
  | {
      status: 'updated';
      signedOut: boolean;
    }
  | {
      status: 'rejected';
      reason:
        'session-required' | 'same-password' | 'weak-password' | 'rate-limited' | 'unavailable';
    };

export async function requestPasswordRecovery(email: string): Promise<RecoveryRequestResult> {
  try {
    const supabase = await createSupabaseMutationClient();

    const redirectTo = `${getApplicationOrigin()}/auth/confirm`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      reportAuthFlowFailure('request-password-recovery', error);

      if (
        isAuthServiceFailure(error) ||
        error.status === 401 ||
        error.code === 'email_provider_disabled'
      ) {
        return 'unavailable';
      }

      // Unknown accounts and account-specific restrictions
      // receive the same public result.
      return 'accepted';
    }

    return 'accepted';
  } catch (error) {
    reportAuthFlowFailure('request-password-recovery', error);

    return 'unavailable';
  }
}

export async function verifyEmailLink(values: EmailLinkValues): Promise<EmailLinkResult> {
  try {
    const supabase = await createSupabaseMutationClient();

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: values.tokenHash,
      type: values.type,
    });

    if (error) {
      reportAuthFlowFailure('verify-email-link', error);

      return {
        status: isAuthServiceFailure(error) ? 'unavailable' : 'invalid',
      };
    }

    if (!data.session || !data.user?.email || !data.user.email_confirmed_at) {
      await supabase.auth.signOut({
        scope: 'local',
      });

      return {
        status: 'invalid',
      };
    }

    return {
      status: 'verified',
      type: values.type,
    };
  } catch (error) {
    reportAuthFlowFailure('verify-email-link', error);

    return {
      status: 'unavailable',
    };
  }
}

export async function updateOwnPassword(password: string): Promise<PasswordUpdateResult> {
  let passwordUpdated = false;

  try {
    const supabase = await createSupabaseMutationClient();

    const identity = await supabase.auth.getUser();

    if (identity.error) {
      return {
        status: 'rejected',
        reason: isAuthServiceFailure(identity.error) ? 'unavailable' : 'session-required',
      };
    }

    if (!identity.data.user?.email || !identity.data.user.email_confirmed_at) {
      return {
        status: 'rejected',
        reason: 'session-required',
      };
    }

    const { data, error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      reportAuthFlowFailure('update-password', error);

      if (error.code === 'same_password') {
        return {
          status: 'rejected',
          reason: 'same-password',
        };
      }

      if (error.code === 'weak_password') {
        return {
          status: 'rejected',
          reason: 'weak-password',
        };
      }

      if (
        error.status === 401 ||
        error.status === 403 ||
        error.code === 'reauthentication_needed' ||
        error.code === 'reauthentication_not_valid'
      ) {
        return {
          status: 'rejected',
          reason: 'session-required',
        };
      }

      return {
        status: 'rejected',
        reason: error.status === 429 ? 'rate-limited' : 'unavailable',
      };
    }

    if (!data.user) {
      return {
        status: 'rejected',
        reason: 'unavailable',
      };
    }

    passwordUpdated = true;

    const logout = await supabase.auth.signOut({
      scope: 'global',
    });

    if (logout.error) {
      reportAuthFlowFailure('sign-out-after-password-update', logout.error);
    }

    return {
      status: 'updated',
      signedOut: !logout.error,
    };
  } catch (error) {
    reportAuthFlowFailure('update-password', error);

    if (passwordUpdated) {
      return {
        status: 'updated',
        signedOut: false,
      };
    }

    return {
      status: 'rejected',
      reason: 'unavailable',
    };
  }
}
