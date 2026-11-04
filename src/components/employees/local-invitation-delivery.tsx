'use client';

import { useRef, useState } from 'react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { replaceLocalInvitation } from '@/features/employee/invitation-recovery-actions';
import { Button } from '@/components/ui/button';
import { deliverLocalInvitation } from '@/features/employee/local-invitation-actions';

export function LocalInvitationDelivery({
  invitationId,
  onCheck,
}: {
  invitationId: string;
  onCheck: () => void;
}) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const recoveryId = useRef<string | null>(null);
  const replacementButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState('');

  async function replace() {
    if (inFlight.current) return;

    if (!reviewed || !recoveryId.current) {
      setError('Review the local email viewer and confirm the checkbox first.');
      return;
    }

    inFlight.current = true;
    setPending(true);
    setError('');

    try {
      const result = await replaceLocalInvitation({
        invitationId,
        requestId: recoveryId.current,
        reviewed: true,
      });

      setMessage(result.message);

      if (result.done) {
        recoveryId.current = null;
        setOpen(false);
        onCheck();
      } else setError(result.message);
    } catch {
      setError('The result is uncertain. Retry this same confirmation to check it.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function deliver() {
    if (inFlight.current) return;

    inFlight.current = true;
    setPending(true);
    onCheck();

    try {
      setMessage(await deliverLocalInvitation(invitationId));
    } catch {
      setMessage('Delivery could not be confirmed. Check again without creating another request.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Local invitation delivery"
      className="space-y-3 rounded-control border border-border p-4"
    >
      <p className="text-sm">
        Local tests only: delivery is restricted to @example.test addresses.
      </p>

      <Button loading={pending} onClick={() => void deliver()}>
        Deliver or check local invitation
      </Button>

      <Button
        ref={replacementButton}
        variant="outline"
        disabled={pending}
        onClick={() => {
          recoveryId.current ??= crypto.randomUUID();
          setReviewed(false);
          setError('');
          setOpen(true);
        }}
      >
        Request replacement link
      </Button>

      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Replace local invitation link"
        description="Review delivery before replacing an expired or uncertain link. Wait one minute after the previous attempt. Existing Auth identity and roles are preserved."
        returnFocusRef={replacementButton}
        pending={pending}
        confirmLabel="Confirm replacement"
        error={error}
        onConfirm={() => void replace()}
      >
        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            checked={reviewed}
            disabled={pending}
            onChange={(event) => setReviewed(event.target.checked)}
          />
          I reviewed the local email viewer and need a replacement link.
        </label>

        <p className="text-sm">
          An uncertain response keeps this request ID. Retrying checks the same attempt without
          sending again.
        </p>
      </ConfirmationDialog>

      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
