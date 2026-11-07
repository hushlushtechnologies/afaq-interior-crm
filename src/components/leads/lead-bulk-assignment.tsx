'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { FormField } from '@/components/forms/form-field';
import { submitBulkAssignment } from '@/features/leads/bulk-actions';
import type { BulkAssignment, BulkResult } from '@/features/leads/bulk-schemas';
import type { Result } from '@/features/leads/schemas';

export function LeadBulkAssignment({
  rows,
  owners,
  disabled,
  onLock,
  onSaved,
}: {
  rows: { id: string; version: number }[];
  owners: { id: string; name: string }[];
  disabled: boolean;
  onLock: (locked: boolean) => void;
  onSaved: (result: BulkResult) => void;
}) {
  const [owner, setOwner] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result<BulkResult> | null>(null);
  const command = useRef<BulkAssignment | null>(null);
  const flight = useRef(false);
  const uncertain = result?.status === 'error' && result.retryable;

  async function execute() {
    if (flight.current) return;

    command.current ??= { requestId: crypto.randomUUID(), rows, owner: owner || null };
    flight.current = true;
    setBusy(true);
    setResult(null);
    onLock(true);

    try {
      const response = await submitBulkAssignment(command.current);
      setResult(response);

      if (response.status === 'ok') {
        command.current = null;
        setOpen(false);
        onLock(false);
        onSaved(response.data);
      } else if (!response.retryable) {
        command.current = null;
      }
    } catch {
      setResult({
        status: 'error',
        message: 'The result could not be confirmed. Retry the same bulk request.',
        retryable: true,
      });
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }

  function close() {
    if (busy || uncertain) return;
    setOpen(false);
    command.current = null;
    setResult(null);
    onLock(false);
  }

  return (
    <section
      aria-label="Bulk lead assignment"
      className="space-y-3 rounded-card border border-border bg-card p-4"
    >
      <p className="text-sm">
        {rows.length} selected on this page. Lost and archived leads cannot be selected.
      </p>

      <FormField id="bulk-owner" label="Bulk assignment owner" disabled={disabled || open}>
        {(control) => (
          <NativeSelect
            {...control}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          >
            <option value="">Unassigned</option>
            {owner && !owners.some((item) => item.id === owner) && (
              <option value={owner} disabled>
                Previously selected owner (currently ineligible)
              </option>
            )}
            {owners.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <Button
        disabled={
          disabled ||
          rows.length === 0 ||
          open ||
          Boolean(owner && !owners.some((item) => item.id === owner))
        }
        onClick={() => {
          setResult(null);
          setOpen(true);
          onLock(true);
        }}
      >
        Assign selected leads
      </Button>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        dismissible={!busy && !uncertain}
        dismissOnOutsideClick={false}
        title="Confirm bulk assignment"
        description="Every selected lead is checked before committing. A stale, inaccessible, Lost or archived record rejects the entire batch."
        footer={
          <>
            <Button variant="outline" disabled={busy || Boolean(uncertain)} onClick={close}>
              Cancel bulk assignment
            </Button>
            <Button loading={busy} onClick={() => void execute()}>
              {uncertain ? 'Retry same bulk request' : 'Confirm assignment'}
            </Button>
          </>
        }
      >
        <p>
          {rows.length} leads → {owners.find((item) => item.id === owner)?.name ?? 'Unassigned'}
        </p>

        {result?.status === 'error' && <p role="alert">{result.message}</p>}
      </Dialog>
    </section>
  );
}
