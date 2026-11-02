'use client';

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { confirmEmailLinkAction } from '@/features/auth/recovery-actions';
import { INITIAL_EMAIL_LINK_STATE, type EmailLinkState } from '@/features/auth/recovery-types';
import { focusRing } from '@/lib/utils';

type EmailLinkInput = {
  tokenHash: string;
  type: string;
};

export function EmailLinkConfirmForm() {
  const [state, dispatch, pending] = useActionState<EmailLinkState, EmailLinkInput>(
    confirmEmailLinkAction,
    INITIAL_EMAIL_LINK_STATE,
  );

  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.message) {
      noticeRef.current?.focus();
    }
  }, [state]);

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fragment = new URLSearchParams(window.location.hash.slice(1));

    const input = {
      tokenHash: fragment.get('token_hash') ?? '',
      type: fragment.get('type') ?? '',
    };

    startTransition(() => dispatch(input));
  }

  return (
    <form aria-label="Confirm email link" onSubmit={handleFormSubmit} className="space-y-5">
      {state.message ? (
        <InlineNotice
          ref={noticeRef}
          role="alert"
          tabIndex={-1}
          title="Link could not be verified"
          tone="warning"
          className={focusRing}
        >
          <p>{state.message}</p>
        </InlineNotice>
      ) : null}

      <p className="text-sm leading-6 text-muted-foreground">
        Select Continue to verify the one-time link from your email.
      </p>

      <Button type="submit" loading={pending} className="w-full">
        Continue
      </Button>
    </form>
  );
}
