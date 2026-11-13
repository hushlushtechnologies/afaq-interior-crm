'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { archiveLeadDetail } from '@/features/lead-details/archive-actions';
import type { ArchiveDetail } from '@/features/lead-details/archive-schemas';
import type { DetailRecord } from '@/features/lead-details/contracts';

export function LeadDetailArchive({
  record,
  disabled,
  acquire,
  release,
  onArchived,
}: {
  record: DetailRecord;
  disabled: boolean;
  acquire: () => boolean;
  release: () => void;
  onArchived: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef<ArchiveDetail | null>(null);
  const flight = useRef(false);
  const locked = busy || uncertain;
  function close() {
    if (locked || flight.current) return;
    setOpen(false);
    request.current = null;
    release();
  }
  async function submit() {
    if (flight.current || !request.current) return;
    flight.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await archiveLeadDetail(request.current);
      if (result.status === 'ok') {
        setOpen(false);
        request.current = null;
        release();
        onArchived();
      } else {
        setMessage(result.message);
        setUncertain(result.retryable);
      }
    } catch {
      setMessage('The result could not be confirmed. Retry the same request.');
      setUncertain(true);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => {
          if (!acquire()) return;
          request.current = {
            requestId: crypto.randomUUID(),
            leadId: record.lead_id,
            recordId: record.id,
            version: record.version,
          };
          setMessage('');
          setUncertain(false);
          setOpen(true);
        }}
      >
        Archive {record.kind}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        dismissible={!locked}
        title={`Archive ${record.kind}`}
        description="The record will move to the archived view. Its content, author and history will be retained."
      >
        <p className="mb-4 break-words text-sm">
          {record.kind === 'room' ? record.data.name : 'Internal note'}
        </p>
        {message && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant="destructive" loading={busy} onClick={() => void submit()}>
            {uncertain ? 'Retry same archive request' : 'Confirm detail archive'}
          </Button>
          <Button variant="outline" disabled={locked} onClick={close}>
            Cancel detail archive
          </Button>
        </div>
      </Dialog>
    </>
  );
}
