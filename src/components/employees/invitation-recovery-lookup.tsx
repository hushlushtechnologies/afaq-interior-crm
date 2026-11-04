'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocalInvitationDelivery } from '@/components/employees/local-invitation-delivery';
import {
  findLocalInvitation,
  type RecoveryInfo,
} from '@/features/employee/invitation-recovery-actions';

export function InvitationRecoveryLookup() {
  const [info, setInfo] = useState<RecoveryInfo | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const email = new FormData(event.currentTarget).get('email');
    inFlight.current = true;
    setPending(true);
    setInfo(null);

    try {
      const result = await findLocalInvitation(email);
      setInfo(result);
      setMessage(result ? '' : 'Invitation not found or access unavailable.');
    } catch {
      setMessage('Lookup could not be completed. Try again.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <details className="space-y-4 rounded-control border border-border p-4">
      <summary className="cursor-pointer font-semibold">Invitation recovery and history</summary>

      <p className="text-sm">
        Find an existing request after refreshing the page. Only local test delivery is available.
        History begins when the lifecycle migration is installed.
      </p>

      <form
        aria-label="Find invitation"
        onSubmit={(event) => void find(event)}
        className="space-y-3"
      >
        <label htmlFor="recovery-email">Invitation email</label>

        <Input
          id="recovery-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
        />

        <Button type="submit" loading={pending}>
          Find invitation
        </Button>
      </form>

      {message ? <p role="status">{message}</p> : null}

      {info ? (
        <div className="space-y-3">
          <p>Current status: {info.status.replaceAll('_', ' ')}</p>

          <ul className="space-y-2 text-sm" aria-label="Invitation history">
            {info.events.map((event, index) => (
              <li key={`${event.at}-${index}`}>
                {event.event.replaceAll('_', ' ')} — {event.actor} —{' '}
                {new Date(event.at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} (Dubai)
              </li>
            ))}
          </ul>

          {!info.events.length ? <p>No lifecycle events recorded yet.</p> : null}

          <LocalInvitationDelivery
            key={info.id}
            invitationId={info.id}
            onCheck={() => setMessage('Find the invitation again to refresh its history.')}
          />
        </div>
      ) : null}
    </details>
  );
}
