'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useAccess } from '@/components/access/access-provider';
import { FilePicker } from '@/components/files/file-picker';
import { DetailSection } from '@/components/layout/detail-section';
import { Button } from '@/components/ui/button';
import { LeadAttachmentLinks } from '@/components/leads/lead-attachment-links';
import { hasRequiredScope } from '@/features/access/permissions';
import { attachmentPageSchema, type AttachmentPage } from '@/features/lead-attachments/contracts';
import { attachmentUploadSchema } from '@/features/lead-attachments/schemas';
import type { LeadRow } from '@/features/leads/schemas';
import { formatFileSize } from '@/lib/forms/file-selection';

const responseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), data: z.unknown() }),
  z.object({ status: z.literal('error'), message: z.string(), retryable: z.boolean() }),
]);

const date = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dubai',
  }).format(new Date(value));

export function LeadAttachments({ lead }: { lead: LeadRow }) {
  const { snapshot } = useAccess();
  const endpoint = `/api/leads/${lead.id}/attachments`;

  const [result, setResult] = useState<AttachmentPage | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [page, setPage] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [progress, setProgress] = useState<string>('');
  const [retrying, setRetrying] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const gate = useRef(false);
  const pending = useRef<{ file: File; input: z.infer<typeof attachmentUploadSchema> } | null>(
    null,
  );
  const removal = useRef<{
    leadId: string;
    attachmentId: string;
    requestId: string;
    version: number;
  } | null>(null);

  function permitted(permission: 'leads.update' | 'leads.archive') {
    return (
      !lead.archived_at &&
      lead.stage !== 'lost' &&
      (hasRequiredScope(snapshot, permission, 'company') ||
        (lead.assigned_user_id === snapshot.userId &&
          hasRequiredScope(snapshot, permission, 'assigned')) ||
        (lead.created_by === snapshot.userId && hasRequiredScope(snapshot, permission, 'own')))
    );
  }

  async function load(next = page, archived = removed) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${endpoint}?page=${next}&removed=${archived}`, {
        cache: 'no-store',
      });
      const payload = responseSchema.parse(await response.json());

      if (payload.status === 'error') throw new Error(payload.message);

      setResult(attachmentPageSchema.parse(payload.data));
      setPage(next);
      setRemoved(archived);
    } catch {
      setResult(null);
      setError(
        'Attachments could not be loaded. Check the local configuration and reload attachments.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    void fetch(`${endpoint}?page=0&removed=false`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((value) => {
        const payload = responseSchema.parse(value);

        if (payload.status === 'error') throw new Error();

        const data = attachmentPageSchema.parse(payload.data);

        if (active) setResult(data);
      })
      .catch(() => {
        if (active)
          setError(
            'Attachments could not be loaded. Check the local configuration and reload attachments.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [endpoint]);

  useEffect(() => {
    if (!retrying && !busy) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [retrying, busy]);

  function upload() {
    if (gate.current || (!file && !pending.current)) return;

    setError('');
    setMessage('');

    if (!pending.current) {
      const parsed = attachmentUploadSchema.safeParse({
        leadId: lead.id,
        requestId: crypto.randomUUID(),
        filename: file!.name,
        declaredMime: file!.type,
        declaredBytes: file!.size,
      });

      if (!parsed.success) {
        setError('Check the filename, file type and 10 MiB limit.');
        return;
      }

      pending.current = { file: file!, input: parsed.data };
    }

    const request = pending.current;
    const wasUncertain = retrying;

    gate.current = true;
    setBusy(true);
    setProgress('Uploading file…');

    const xhr = new XMLHttpRequest();

    xhr.open('POST', endpoint);
    xhr.timeout = 60000;
    xhr.setRequestHeader('Content-Type', request.input.declaredMime);
    xhr.setRequestHeader('x-attachment-request', encodeURIComponent(JSON.stringify(request.input)));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setProgress(`Uploading ${Math.round((event.loaded / event.total) * 100)}%`);
    };

    xhr.upload.onload = () => setProgress('Validating and storing file…');

    async function finish() {
      try {
        const payload = responseSchema.parse(JSON.parse(xhr.responseText));

        if (payload.status === 'error') {
          setError(payload.message);

          // A later rejection cannot prove that an earlier lost response did not commit.
          const keepRequest = payload.retryable || wasUncertain;

          setRetrying(keepRequest);

          if (!keepRequest) pending.current = null;

          return;
        }

        pending.current = null;
        setRetrying(false);
        setFile(null);
        setPickerKey((key) => key + 1);
        setMessage('Attachment uploaded. Local validation is not malware scanning.');

        await load(0, false);
      } catch {
        setRetrying(true);
        setError('Upload outcome is unconfirmed. Keep this page open and retry the same upload.');
      } finally {
        gate.current = false;
        setBusy(false);
        setProgress('');
      }
    }

    xhr.onload = () => {
      void finish();
    };

    xhr.onerror = xhr.ontimeout = () => {
      setRetrying(true);
      setError('Upload outcome is unconfirmed. Keep this page open and retry the same upload.');
      gate.current = false;
      setBusy(false);
      setProgress('');
    };

    xhr.send(request.file);
  }

  async function act(operation: 'download' | 'remove', row: AttachmentPage['rows'][number]) {
    if (gate.current || retrying) return;

    gate.current = true;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const ref = { leadId: lead.id, attachmentId: row.id };

      if (operation === 'remove' && removal.current?.attachmentId !== row.id) {
        removal.current = { ...ref, requestId: crypto.randomUUID(), version: row.version };
      }

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, input: operation === 'remove' ? removal.current : ref }),
      });

      const payload = responseSchema.parse(await response.json());

      if (payload.status === 'error') throw new Error(payload.message);

      if (operation === 'download') {
        const data = z.object({ url: z.url(), expiresIn: z.literal(60) }).parse(payload.data);
        const link = document.createElement('a');

        link.href = data.url;
        link.download = row.filename;
        link.rel = 'noreferrer';
        link.click();

        setMessage('Download access issued for 60 seconds.');
      } else {
        setConfirmId(null);
        removal.current = null;
        setMessage('Attachment removed. Metadata and audit history retained.');

        await load(0, removed);
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'The result is unconfirmed. Retry the same action.',
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }

  const locked = busy || retrying;

  return (
    <div className="mx-auto mt-6 max-w-7xl">
      <DetailSection
        id="real-attachments"
        title="Private attachments"
        description="PDF, PNG, JPEG and WebP · maximum 10 MiB each · local validation only, without malware scanning."
      >
        {permitted('leads.update') && (
          <div className="mb-6 space-y-4">
            <FilePicker
              key={pickerKey}
              id="lead-attachment-file"
              label="Select lead attachment"
              maxFiles={1}
              disabled={locked}
              onFilesChange={(files) => setFile(files[0] ?? null)}
            />
            <Button disabled={busy || !file} onClick={upload}>
              {retrying ? 'Retry same upload' : 'Upload attachment'}
            </Button>
          </div>
        )}

        {progress && <p role="status">{progress}</p>}

        {message && (
          <p role="status" className="mb-3 text-sm">
            {message}
          </p>
        )}

        {error && (
          <p role="alert" className="mb-3 text-sm">
            {error}
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={locked || loading}
            onClick={() => void load(0, !removed)}
          >
            Show {removed ? 'active' : 'removed'} attachments
          </Button>
          <Button variant="outline" disabled={locked || loading} onClick={() => void load()}>
            Reload attachments
          </Button>
        </div>

        {loading ? (
          <p role="status">Loading attachments…</p>
        ) : (
          result && (
            <>
              <p className="mb-3 text-sm">
                Attachments page {page + 1}: {result.rows.length} of {result.total}
              </p>

              {result.rows.length === 0 && (
                <p>No {removed ? 'removed' : 'active'} attachments on this page.</p>
              )}

              <ul className="space-y-3" aria-label="Lead attachments">
                {result.rows.map((row) => (
                  <li
                    key={row.id}
                    className="space-y-2 rounded-control border border-border bg-background p-4"
                  >
                    <p className="break-all font-semibold">{row.filename}</p>

                    <p className="text-sm">
                      {row.mime} · {formatFileSize(row.bytes)} · {row.state}
                    </p>

                    <p className="break-all text-xs text-muted-foreground">
                      Uploaded {date(row.created_at)} (Dubai) by{' '}
                      {row.actor_id === snapshot.userId ? 'you' : row.actor_id}
                    </p>

                    {row.removed_at && (
                      <p className="text-xs">
                        Removed {date(row.removed_at)} (Dubai). History retained.
                      </p>
                    )}

                    <LeadAttachmentLinks leadId={lead.id} attachmentId={row.id} disabled={locked} />

                    {row.state === 'ready' && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={locked}
                          onClick={() => void act('download', row)}
                        >
                          Download attachment
                        </Button>

                        {permitted('leads.archive') &&
                          (confirmId === row.id ? (
                            <>
                              <Button disabled={locked} onClick={() => void act('remove', row)}>
                                Confirm removal
                              </Button>
                              <Button
                                variant="outline"
                                disabled={locked}
                                onClick={() => setConfirmId(null)}
                              >
                                Keep attachment
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              disabled={locked}
                              onClick={() => setConfirmId(row.id)}
                            >
                              Remove attachment
                            </Button>
                          ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  disabled={locked || page === 0}
                  onClick={() => void load(page - 1)}
                >
                  Previous attachments
                </Button>
                <Button
                  variant="outline"
                  disabled={locked || (page + 1) * 20 >= result.total}
                  onClick={() => void load(page + 1)}
                >
                  Next attachments
                </Button>
              </div>
            </>
          )
        )}
      </DetailSection>
    </div>
  );
}
