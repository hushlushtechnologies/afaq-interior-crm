'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DetailSection } from '@/components/layout/detail-section';
import { LeadImportRows } from './lead-import-rows';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  confirmImport,
  getImport,
  ImportClientError,
  type ImportConfirmation,
} from '@/features/lead-import/client';
import type { ImportPage } from '@/features/lead-import/contracts';

const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export function LeadImportBatch({
  batchId,
  onLock,
}: {
  batchId: string;
  onLock: (locked: boolean) => void;
}) {
  const [view, setView] = useState<ImportPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [skips, setSkips] = useState<Set<number>>(new Set());
  const [blocked, setBlocked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const flight = useRef(false);
  const dialogOpen = useRef(false);
  const pending = useRef<ImportConfirmation | null>(null);
  const version = useRef<number | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  const accept = useCallback((response: ImportPage) => {
    const required = response.rows
      .filter((row) => ['invalid', 'review'].includes(row.status))
      .map((row) => row.row_number);

    if (version.current !== response.batch.version) {
      setSkips(new Set());
      setBlocked(new Set(required));
    } else {
      setBlocked((old) => new Set([...old, ...required]));
    }

    version.current = response.batch.version;
    setView(response);
  }, []);

  useEffect(() => {
    let active = true;
    onLock(true);
    void getImport(batchId, 0)
      .then((response) => {
        if (active) accept(response);
      })
      .catch((failure: unknown) => {
        if (active)
          setError(failure instanceof Error ? failure.message : 'The batch could not be loaded.');
      })
      .finally(() => {
        if (active) {
          setBusy(false);
          onLock(false);
        }
      });
    return () => {
      active = false;
    };
  }, [batchId, onLock, accept]);

  async function reload(page: number) {
    if (flight.current || pending.current || dialogOpen.current) return;
    flight.current = true;
    setBusy(true);
    setError('');
    onLock(true);
    try {
      accept(await getImport(batchId, page));
    } catch (failure) {
      setView(null);
      setError(failure instanceof Error ? failure.message : 'The batch could not be loaded.');
    } finally {
      flight.current = false;
      setBusy(false);
      onLock(false);
    }
  }

  function showConfirmation(next: boolean) {
    if (flight.current || pending.current) return;
    dialogOpen.current = next;
    setOpen(next);
    setError('');
    onLock(next);
  }

  async function execute(command: ImportConfirmation) {
    if (flight.current) return;
    flight.current = true;
    pending.current = command;
    setBusy(true);
    setError('');
    onLock(true);

    try {
      const response = await confirmImport(command);
      pending.current = null;
      setUncertain(false);
      dialogOpen.current = false;
      setOpen(false);
      setMessage(
        response.requiresReview
          ? 'New duplicate found. No leads were created. Review and explicitly skip the flagged rows.'
          : `Import completed: ${response.applied} ${response.applied === 1 ? 'lead' : 'leads'} created, ${response.skipped} ${response.skipped === 1 ? 'row' : 'rows'} skipped.`,
      );
      accept({ batch: response.batch, page: 0, pageSize: 20, rows: [], events: [] });
      try {
        accept(await getImport(batchId, 0));
      } catch {
        setView(null);
        setError('The outcome was recorded, but rows could not be reloaded. Reload batch.');
      }
    } catch (failure) {
      const retryable = !(failure instanceof ImportClientError) || failure.retryable;
      setUncertain(retryable);
      if (!retryable) pending.current = null;
      setError(
        failure instanceof Error
          ? failure.message
          : 'The result is uncertain. Retry the same confirmation.',
      );
    } finally {
      flight.current = false;
      setBusy(false);
      onLock(dialogOpen.current || pending.current !== null);
    }
  }

  const locked = busy || uncertain || open;
  const counts = view?.batch.counts;
  const unresolved = counts
    ? counts.invalid + counts.review - [...skips].filter((row) => blocked.has(row)).length
    : 0;
  const completed = view?.batch.status === 'completed';

  return (
    <DetailSection
      id="import-batch"
      title="Saved import batch"
      description="Only your current authorized batch is shown. Review rows before confirming."
      actions={
        <Button variant="outline" disabled={locked} onClick={() => void reload(view?.page ?? 0)}>
          Reload batch
        </Button>
      }
    >
      <p className="break-all text-sm">Batch ID: {batchId}</p>
      {busy && (
        <p role="status" className="my-3">
          Loading or saving import…
        </p>
      )}
      {message && (
        <p role="status" className="my-3">
          {message}
        </p>
      )}
      {error && !open && (
        <p role="alert" className="my-3">
          {error}
        </p>
      )}

      {view && (
        <div className="mt-4 space-y-5">
          <p className="break-words text-sm">
            {view.batch.filename} · {view.batch.status} · Version {view.batch.version}
          </p>
          <p className="text-sm">
            Total {counts!.total} · Ready {counts!.ready} · Invalid {counts!.invalid} · Review{' '}
            {counts!.review} · Applied {counts!.applied} · Skipped {counts!.skipped}
          </p>
          {!completed && (
            <p className="text-sm">
              Explicit skips selected: {skips.size}. Required skips remaining: {unresolved}.
              Selections remain checked across pages.
            </p>
          )}
          <LeadImportRows
            rows={view.rows.map((row) => ({
              rowNumber: row.row_number,
              data: row.data,
              status: row.status,
              errors: row.errors.map(
                (field) => `${field.replaceAll('_', ' ')} needs correction in the source file.`,
              ),
              duplicateRows: row.duplicate_rows,
              databaseMatch: row.database_match,
              redacted: row.redacted,
              leadId: row.resulting_lead_id,
            }))}
            skips={skips}
            disabled={locked}
            onSkip={
              completed
                ? undefined
                : (row, checked) => {
                    if (flight.current || pending.current || dialogOpen.current) return;
                    setSkips((old) => {
                      const next = new Set(old);
                      if (checked) next.add(row);
                      else next.delete(row);
                      return next;
                    });
                  }
            }
          />

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={locked || view.page === 0}
              onClick={() => void reload(view.page - 1)}
            >
              Previous batch page
            </Button>
            <Button
              variant="outline"
              disabled={locked || (view.page + 1) * 20 >= counts!.total}
              onClick={() => void reload(view.page + 1)}
            >
              Next batch page
            </Button>
            {!completed && (
              <Button disabled={locked || unresolved > 0} onClick={() => showConfirmation(true)}>
                Review confirmation
              </Button>
            )}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Import history</summary>
            <ol className="mt-3 space-y-2">
              {view.events.map((event) => (
                <li key={event.id}>
                  {event.action.replaceAll('_', ' ')} · You · {time(event.occurred_at)} (Dubai)
                  {event.action === 'confirmed' && (
                    <p>
                      Applied: {String(event.detail.applied)}. Explicit skipped rows:{' '}
                      {JSON.stringify(event.detail.skippedRows)}.
                    </p>
                  )}
                  {event.action === 'duplicates_detected' && (
                    <p>Rows needing review: {JSON.stringify(event.detail.rows)}.</p>
                  )}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={showConfirmation}
        title="Confirm CSV import"
        description={`Create ${(counts?.total ?? 0) - skips.size} leads and skip ${skips.size} rows. Existing leads will not be overwritten or merged.`}
        initialFocusRef={cancel}
        dismissible={!busy && !uncertain}
        dismissOnOutsideClick={false}
        footer={
          <>
            <Button
              ref={cancel}
              variant="outline"
              disabled={busy || uncertain}
              onClick={() => showConfirmation(false)}
            >
              Cancel import confirmation
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                if (!view || flight.current) return;
                void execute(
                  pending.current ?? {
                    requestId: crypto.randomUUID(),
                    batchId,
                    version: view.batch.version,
                    skips: [...skips].sort((a, b) => a - b),
                  },
                );
              }}
            >
              {uncertain ? 'Retry same confirmation' : 'Confirm import'}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Every invalid and duplicate row must be explicitly skipped. Confirmation creates all
          selected leads together.
        </p>
        {error && <p role="alert">{error}</p>}
        {uncertain && (
          <p role="status">
            Keep this dialog open and retry the unchanged confirmation. Its request ID is preserved.
          </p>
        )}
      </Dialog>
    </DetailSection>
  );
}
