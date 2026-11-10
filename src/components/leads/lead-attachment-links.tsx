'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  loadAttachmentLinks,
  submitAttachmentLink,
} from '@/features/lead-attachments/link-actions';
import type {
  AttachmentLinkCommand,
  AttachmentLinkPage,
} from '@/features/lead-attachments/link-schemas';

function label(kind: 'room' | 'visit', value: string) {
  return kind === 'room'
    ? value
    : new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Dubai',
      }).format(new Date(value)) + ' (Dubai)';
}

export function LeadAttachmentLinks({
  leadId,
  attachmentId,
  disabled,
}: {
  leadId: string;
  attachmentId: string;
  disabled: boolean;
}) {
  const id = useId();
  const [loaded, setLoaded] = useState(false);

  return (
    <details
      className="mt-3 border-t border-border pt-3"
      onToggle={(event) => {
        if (event.currentTarget.open) setLoaded(true);
      }}
    >
      <summary className="cursor-pointer text-sm font-medium">
        Room and site-visit references
      </summary>
      {loaded && (
        <ReferenceEditor
          key={attachmentId}
          leadId={leadId}
          attachmentId={attachmentId}
          disabled={disabled}
          id={id}
        />
      )}
    </details>
  );
}

function ReferenceEditor({
  leadId,
  attachmentId,
  disabled,
  id,
}: {
  leadId: string;
  attachmentId: string;
  disabled: boolean;
  id: string;
}) {
  const [data, setData] = useState<AttachmentLinkPage | null>(null);
  const [kind, setKind] = useState<'room' | 'visit'>('room');
  const [target, setTarget] = useState('');
  const [targetPage, setTargetPage] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const gate = useRef(false);
  const pending = useRef<AttachmentLinkCommand | null>(null);

  useEffect(() => {
    let active = true;

    void loadAttachmentLinks({ leadId, attachmentId, kind: 'room', targetPage: 0, page: 0 })
      .then((result) => {
        if (active) {
          if (result.status === 'ok') setData(result.data);
          else setError(result.message);
        }
      })
      .catch(() => {
        if (active) setError('References could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [leadId, attachmentId]);

  async function reload(nextKind = kind, nextTargetPage = targetPage, nextPage = page) {
    setLoading(true);
    setError('');

    try {
      const result = await loadAttachmentLinks({
        leadId,
        attachmentId,
        kind: nextKind,
        targetPage: nextTargetPage,
        page: nextPage,
      });

      if (result.status === 'error') {
        setData(null);
        setError(result.message);
        return;
      }

      setData(result.data);
      setKind(nextKind);
      setTargetPage(nextTargetPage);
      setPage(nextPage);
      setTarget('');
    } catch {
      setData(null);
      setError('References could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function save(command?: AttachmentLinkCommand) {
    if (gate.current || disabled) return;

    const request = pending.current ?? command;

    if (!request) return;

    pending.current = request;
    gate.current = true;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await submitAttachmentLink(request);

      if (result.status === 'error') {
        setError(result.message);

        const keep = result.retryable || uncertain;

        setUncertain(keep);

        if (!keep) pending.current = null;

        return;
      }

      pending.current = null;
      setUncertain(false);
      setMessage('Reference saved. File and history retained.');

      await reload(kind, targetPage, 0);
    } catch {
      setUncertain(true);
      setError('The result is unconfirmed. Retry the same reference request.');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }

  const locked = disabled || busy || uncertain || loading;

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-muted-foreground">
        Link this existing file to rooms or planned visits on this lead. Finalized visit references
        stay unchanged.
      </p>

      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}

      {loading && <p role="status">Loading references…</p>}

      {uncertain && (
        <Button disabled={disabled || busy} onClick={() => void save()}>
          Retry same reference request
        </Button>
      )}

      <Button variant="outline" disabled={locked} onClick={() => void reload()}>
        Reload references
      </Button>

      {data && (
        <>
          {data.canLink && (
            <div className="space-y-3">
              <div>
                <label htmlFor={`${id}-kind`} className="block text-sm">
                  Reference type
                </label>
                <select
                  id={`${id}-kind`}
                  className="w-full rounded-control border border-input bg-background p-2"
                  value={kind}
                  disabled={locked}
                  onChange={(event) => void reload(event.target.value as 'room' | 'visit', 0, page)}
                >
                  <option value="room">Room</option>
                  <option value="visit">Site visit</option>
                </select>
              </div>

              <div>
                <label htmlFor={`${id}-target`} className="block text-sm">
                  Reference target
                </label>
                <select
                  id={`${id}-target`}
                  className="w-full rounded-control border border-input bg-background p-2"
                  value={target}
                  disabled={locked}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">Choose a {kind === 'room' ? 'room' : 'planned visit'}</option>
                  {data.targets.map((item) => (
                    <option key={item.id} value={item.id} disabled={!item.writable}>
                      {label(kind, item.label)} · {item.state}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs">
                Target page {targetPage + 1}: {data.targets.length} of {data.targetTotal}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={locked || targetPage === 0}
                  onClick={() => void reload(kind, targetPage - 1)}
                >
                  Previous targets
                </Button>
                <Button
                  variant="outline"
                  disabled={locked || (targetPage + 1) * 20 >= data.targetTotal}
                  onClick={() => void reload(kind, targetPage + 1)}
                >
                  Next targets
                </Button>
                <Button
                  disabled={locked || !target}
                  onClick={() =>
                    void save({
                      command: 'link',
                      requestId: crypto.randomUUID(),
                      leadId,
                      attachmentId,
                      data: { kind, targetId: target },
                    })
                  }
                >
                  Link reference
                </Button>
              </div>
            </div>
          )}

          <p className="text-sm">
            Reference page {page + 1}: {data.links.length} of {data.total}
          </p>

          {data.links.length === 0 && <p className="text-sm">No references recorded.</p>}

          <ul className="space-y-2" aria-label="File references">
            {data.links.map((link) => (
              <li key={link.id} className="rounded-control border border-border p-3 text-sm">
                <p className="break-words">
                  {link.kind === 'room' ? 'Room' : 'Site visit'}: {label(link.kind, link.label)}
                </p>

                <p>{link.archived_at ? 'Unlinked — history retained' : 'Linked'}</p>

                <p className="break-all text-xs">
                  Linked {label('visit', link.created_at)} by {link.created_by}.{' '}
                  {link.archived_by && link.archived_at
                    ? `Unlinked ${label('visit', link.archived_at)} by ${link.archived_by}.`
                    : ''}
                </p>

                {link.canUnlink && (
                  <Button
                    variant="outline"
                    disabled={locked}
                    onClick={() =>
                      void save({
                        command: 'unlink',
                        requestId: crypto.randomUUID(),
                        leadId,
                        attachmentId,
                        data: { linkId: link.id, version: link.version },
                      })
                    }
                  >
                    Unlink reference
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={locked || page === 0}
              onClick={() => void reload(kind, targetPage, page - 1)}
            >
              Previous references
            </Button>
            <Button
              variant="outline"
              disabled={locked || (page + 1) * 20 >= data.total}
              onClick={() => void reload(kind, targetPage, page + 1)}
            >
              Next references
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
