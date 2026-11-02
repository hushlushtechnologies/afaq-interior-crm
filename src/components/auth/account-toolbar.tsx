'use client';

import { useActionState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { signOutAction } from '@/features/auth/actions';
import { INITIAL_SIGN_OUT_STATE, type SignOutActionState } from '@/features/auth/types';

export function AccountToolbar({ email }: { email: string }) {
  const [state, dispatch, pending] = useActionState<SignOutActionState>(
    signOutAction,
    INITIAL_SIGN_OUT_STATE,
  );

  return (
    <section aria-label="Account session" className="space-y-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge tone="success">Signed in</Badge>

          <p className="min-w-0 break-all text-sm text-muted-foreground">{email}</p>
        </div>

        <form action={dispatch} aria-label="Sign out">
          <Button type="submit" variant="outline" size="sm" loading={pending}>
            Sign out
          </Button>
        </form>
      </div>

      {state.message ? (
        <InlineNotice role="alert" title="Sign-out unsuccessful" tone="destructive">
          <p>{state.message}</p>
        </InlineNotice>
      ) : null}
    </section>
  );
}
