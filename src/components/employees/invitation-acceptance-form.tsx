'use client';

import Link from 'next/link';
import { useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import {
  acceptLocalInvitation,
  verifyLocalInvitation,
} from '@/features/employee/local-invitation-actions';

const subscribe = () => () => {};

export function InvitationAcceptanceForm({
  ready = false,
  accepted = false,
}: {
  ready?: boolean;
  accepted?: boolean;
}) {
  const [phase, setPhase] = useState<'link' | 'password' | 'done'>(
    accepted ? 'done' : ready ? 'password' : 'link',
  );

  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;

    busy.current = true;
    const values = new FormData(event.currentTarget);
    setPending(true);
    setMessage('');

    try {
      if (phase === 'link') {
        const fragment = new URLSearchParams(window.location.hash.slice(1));

        const error = await verifyLocalInvitation({
          tokenHash: fragment.get('token_hash') ?? '',
          type: fragment.get('type') ?? 'invite',
        });

        if (error) {
          setMessage(error);
          return;
        }

        window.history.replaceState(null, '', window.location.pathname);
        setPhase('password');
      } else {
        const error = await acceptLocalInvitation({
          password: values.get('password'),
          confirmPassword: values.get('confirmPassword'),
        });

        if (error) {
          setMessage(error);
          return;
        }

        setPhase('done');
      }
    } catch {
      setMessage('The result could not be confirmed. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (phase === 'done')
    return (
      <div className="space-y-4">
        <p role="status">
          Invitation accepted. No roles were assigned. Ask your administrator to configure workspace
          access.
        </p>

        <Link href="/login" className="underline">
          Sign in
        </Link>
      </div>
    );

  return (
    <form
      aria-label="Accept employee invitation"
      onSubmit={(event) => void submit(event)}
      className="space-y-5"
    >
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      {phase === 'password' ? (
        <>
          <FormField id="invite-password" label="New password" required>
            {(props) => (
              <PasswordInput
                {...props}
                name="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={72}
                disabled={pending || !hydrated}
              />
            )}
          </FormField>

          <FormField id="invite-confirm-password" label="Confirm password" required>
            {(props) => (
              <PasswordInput
                {...props}
                name="confirmPassword"
                autoComplete="new-password"
                minLength={12}
                maxLength={72}
                disabled={pending || !hydrated}
              />
            )}
          </FormField>
        </>
      ) : (
        <p>Select Continue to verify the invitation link from the local email viewer.</p>
      )}

      <Button type="submit" loading={pending} disabled={!hydrated}>
        {phase === 'link' ? 'Continue' : 'Set initial password'}
      </Button>
    </form>
  );
}
