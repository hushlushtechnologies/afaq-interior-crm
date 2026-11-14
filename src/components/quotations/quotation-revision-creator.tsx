'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/forms/form-field';
import { DetailSection } from '@/components/layout/detail-section';
import { Button, buttonClassName } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createQuotationRevision } from '@/features/quotations/revision-actions';
import {
  createQuotationRevisionSchema,
  type CreateQuotationRevision,
} from '@/features/quotations/revision-contracts';

export function QuotationRevisionCreator({
  id,
  number,
  revision,
  version,
}: {
  id: string;
  number: string;
  revision: number;
  version: number;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [completed, setCompleted] = useState(false);

  const gate = useRef(false);
  const pending = useRef<CreateQuotationRevision | null>(null);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (pending.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    }

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  async function submit() {
    if (gate.current || completed) return;

    if (!pending.current) {
      const parsed = createQuotationRevisionSchema.safeParse({
        requestId: crypto.randomUUID(),
        quotationId: id,
        expectedVersion: version,
        expectedRevision: revision,
        reason,
      });

      if (!parsed.success) {
        setMessage('Enter a revision reason of 1 to 2000 characters.');
        return;
      }

      pending.current = parsed.data;
    }

    gate.current = true;
    setBusy(true);
    setMessage('');

    try {
      const result = await createQuotationRevision(pending.current);

      if (result.status === 'error') {
        setUncertain(result.retryable);

        if (!result.retryable) pending.current = null;

        setMessage(result.message);
        return;
      }

      pending.current = null;
      setUncertain(false);
      setCompleted(true);
      setMessage(`Revision ${result.data.revision} created. Opening the current draft…`);

      router.replace(`/quotations/${id}`);
      router.refresh();
    } catch {
      setUncertain(true);
      setMessage('The result could not be confirmed. Retry this unchanged request.');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }

  const locked = busy || uncertain || completed;

  return (
    <DetailSection
      id="create-quotation-revision"
      title="Create commercial revision"
      description={`${number} · Current Revision ${revision} · Saved version ${version}`}
    >
      <p className="mb-4 text-sm">
        This copies the latest saved draft into Revision {revision + 1}. Earlier saved versions,
        financial values and revision reasons remain in history. The new revision stays Draft.
      </p>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FormField label="Revision reason" required disabled={locked}>
          {(props) => (
            <Textarea
              {...props}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </FormField>

        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || completed} loading={busy}>
            {uncertain ? 'Retry revision creation' : 'Create next revision'}
          </Button>

          <a
            href={`/quotations/${id}`}
            aria-disabled={locked}
            onClick={(event) => {
              if (locked || gate.current) event.preventDefault();
            }}
            className={buttonClassName({ variant: 'outline' })}
          >
            Back to latest saved draft
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          Creation requires the saved version shown above to remain current. An uncertain retry
          retains its original request ID and reason. No approval, PDF or delivery is created.
        </p>
      </form>
    </DetailSection>
  );
}