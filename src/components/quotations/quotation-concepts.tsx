'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { DetailSection } from '@/components/layout/detail-section';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { Result } from '@/features/leads/schemas';
import type { ConceptWorkspace } from '@/features/quotations/concept-ui-contracts';
import {
  loadConceptWorkspace,
  submitQuotationConcept,
  previewQuotationConcept,
} from '@/features/quotations/concept-actions';

const date = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dubai',
  }).format(new Date(value));

export function QuotationConcepts({
  id,
  revision,
  rooms,
  roomsTruncated,
  initial,
}: {
  id: string;
  revision: number;
  rooms: Array<{ id: string; name: string }>;
  roomsTruncated: boolean;
  initial: Result<ConceptWorkspace>;
}) {
  const [result, setResult] = useState(initial);
  const [page, setPage] = useState(0);
  const [imagePage, setImagePage] = useState(0);
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [imageId, setImageId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<{
    referenceId: string;
    url: string;
    expiresAt: number;
  } | null>(null);
  const gate = useRef(false);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null);
  useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(
      () => setPreview(null),
      Math.max(0, preview.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [preview]);
  async function refresh(nextPage = page, nextArchived = archived, nextImagePage = imagePage) {
    const next = await loadConceptWorkspace({
      id,
      revision,
      page: nextPage,
      archived: nextArchived,
      imagePage: nextImagePage,
    });
    setResult(next);
    setPage(nextPage);
    setArchived(nextArchived);
    setImagePage(nextImagePage);
  }
  async function run(task: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setPreview(null);
    setError('');
    setMessage('');
    try {
      await task();
    } catch {
      setError('The result is unconfirmed. Retry the same request or reload references.');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function save(command: 'register' | 'select' | 'archive', data: object) {
    const base = { quotationId: id, revision, command, data };
    const fingerprint = JSON.stringify(base);
    if (retry.current?.fingerprint !== fingerprint)
      retry.current = { fingerprint, id: crypto.randomUUID() };
    const saved = await submitQuotationConcept({ ...base, requestId: retry.current.id });
    if (saved.status === 'error') {
      setError(saved.message);
      if (!saved.retryable) retry.current = null;
      return;
    }
    retry.current = null;
    if (command === 'register') {
      setTitle('');
      setPrompt('');
      setImageId('');
      setRoomId('');
    }
    setMessage('Reference saved. Source image and history retained.');
    await refresh(command === 'register' ? 0 : page);
  }
  const data = result.status === 'ok' ? result.data : null;
  return (
    <div className="mx-auto my-6 min-w-0 max-w-7xl">
      <DetailSection
        id="quotation-concepts"
        title="Concept references"
        description={`Revision ${revision}. Private existing images; illustrative references, not construction-ready drawings.`}
        actions={
          <Button variant="outline" disabled={busy} onClick={() => void run(() => refresh())}>
            Reload concept references
          </Button>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Live AI generation is not configured. Prompt notes stay internal. No AI calls are made,
          and references are not included in quotation PDFs.
        </p>
        {busy && <p role="status">Loading concept references…</p>}
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
        {result.status === 'error' && <p role="alert">{result.message}</p>}
        {data && (
          <>
            {data.references.canEdit && !archived && (
              <form
                className="mb-6 space-y-4 rounded-control border border-border p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(() =>
                    save('register', {
                      attachmentId: imageId,
                      roomId: roomId || null,
                      title,
                      promptNotes: prompt.trim() || null,
                    }),
                  );
                }}
              >
                <FormField
                  label="Reference image"
                  required
                  disabled={busy}
                  description="Use images uploaded through this lead's validated attachments workflow."
                >
                  {(props) => (
                    <NativeSelect
                      {...props}
                      value={imageId}
                      onChange={(event) => setImageId(event.target.value)}
                    >
                      <option value="">Choose an image</option>
                      {data.context.images.map((image) => (
                        <option key={image.id} value={image.id}>
                          {image.filename}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
                <p className="text-xs text-muted-foreground">
                  Image page {imagePage + 1}: {data.context.images.length} of{' '}
                  {data.context.imageTotal}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || imagePage === 0}
                    onClick={() =>
                      void run(async () => {
                        setImageId('');
                        await refresh(page, archived, imagePage - 1);
                      })
                    }
                  >
                    Previous image page
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      busy || (imagePage + 1) * 20 >= data.context.imageTotal || imagePage >= 10000
                    }
                    onClick={() =>
                      void run(async () => {
                        setImageId('');
                        await refresh(page, archived, imagePage + 1);
                      })
                    }
                  >
                    Next image page
                  </Button>
                </div>
                <FormField label="Reference title" required disabled={busy}>
                  {(props) => (
                    <Input
                      {...props}
                      value={title}
                      minLength={2}
                      maxLength={160}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Room or area" disabled={busy}>
                  {(props) => (
                    <NativeSelect
                      {...props}
                      value={roomId}
                      onChange={(event) => setRoomId(event.target.value)}
                    >
                      <option value="">No room association</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
                {roomsTruncated && (
                  <p className="text-xs text-muted-foreground">
                    Room choices are limited to the first 200 recorded rooms. Other references can
                    remain unassigned.
                  </p>
                )}
                <FormField
                  label="Prompt planning notes"
                  disabled={busy}
                  description="Internal notes only. Nothing is sent to an AI provider."
                >
                  {(props) => (
                    <Textarea
                      {...props}
                      value={prompt}
                      maxLength={2000}
                      onChange={(event) => setPrompt(event.target.value)}
                    />
                  )}
                </FormField>
                <Button type="submit" disabled={busy || !imageId}>
                  Register reference image
                </Button>
              </form>
            )}
            <div className="mb-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => refresh(0, !archived))}
              >
                Show {archived ? 'active' : 'archived'} references
              </Button>
              <p className="text-sm text-muted-foreground">
                {archived ? 'Archived' : 'Active'} reference page {page + 1}:{' '}
                {data.references.rows.length} of {data.references.total}
              </p>
            </div>
            {!data.references.rows.length && (
              <p className="text-sm text-muted-foreground">No references on this page.</p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {data.references.rows.map((item) => (
                <article
                  key={item.id}
                  className="min-w-0 space-y-3 rounded-control border border-border p-4"
                >
                  <h3 className="break-words font-semibold">{item.title}</h3>
                  <p className="break-words text-sm">
                    {item.filename} ·{' '}
                    {item.selected ? 'Selected for internal review' : 'Not selected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Existing reference · No AI generation recorded · Version {item.version}
                  </p>
                  <p className="text-sm">
                    Room:{' '}
                    {rooms.find((room) => room.id === item.roomId)?.name ??
                      (item.roomId ? 'Recorded room' : 'Not associated')}
                  </p>
                  {item.promptNotes && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      Internal prompt notes: {item.promptNotes}
                    </p>
                  )}
                  {!item.available && (
                    <p className="text-sm">
                      Source image or room is unavailable. Review this association.
                    </p>
                  )}
                  <p className="break-all text-xs text-muted-foreground">
                    Recorded {date(item.createdAt)} (Dubai) by {item.createdBy}
                  </p>
                  {item.archivedAt && (
                    <p className="text-xs">
                      Archived {date(item.archivedAt)} (Dubai). History retained.
                    </p>
                  )}
                  {!archived && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={busy || !item.available}
                        onClick={() =>
                          void run(async () => {
                            const access = await previewQuotationConcept({
                              id,
                              referenceId: item.id,
                            });
                            if (access.status === 'error') {
                              setError(access.message);
                              return;
                            }
                            setPreview({ referenceId: item.id, ...access.data });
                          })
                        }
                      >
                        Preview {item.title}
                      </Button>
                      {data.references.canEdit && (
                        <>
                          <Button
                            variant="outline"
                            disabled={busy || (!item.available && !item.selected)}
                            onClick={() =>
                              void run(() =>
                                save('select', {
                                  id: item.id,
                                  version: item.version,
                                  selected: !item.selected,
                                }),
                              )
                            }
                          >
                            {item.selected ? 'Deselect' : 'Select'} {item.title}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void run(() =>
                                save('archive', { id: item.id, version: item.version }),
                              )
                            }
                          >
                            Archive {item.title}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {preview?.referenceId === item.id && (
                    <figure className="space-y-2">
                      <Image
                        unoptimized
                        src={preview.url}
                        alt={`Private reference: ${item.title}`}
                        width={800}
                        height={600}
                        referrerPolicy="no-referrer"
                        className="max-h-80 w-full rounded-control object-contain"
                        onError={() => {
                          setPreview(null);
                          setError('Preview expired or could not be loaded. Request it again.');
                        }}
                      />
                      <figcaption className="text-xs text-muted-foreground">
                        Private preview expires within 60 seconds.
                      </figcaption>
                      <Button variant="outline" onClick={() => setPreview(null)}>
                        Close private preview
                      </Button>
                    </figure>
                  )}
                </article>
              ))}
            </div>
            <div className="my-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={busy || page === 0}
                onClick={() => void run(() => refresh(page - 1))}
              >
                Previous reference page
              </Button>
              <Button
                variant="outline"
                disabled={busy || (page + 1) * 20 >= data.references.total || page >= 10000}
                onClick={() => void run(() => refresh(page + 1))}
              >
                Next reference page
              </Button>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">
                Reference history — latest 50 events
              </summary>
              <ol className="mt-3 space-y-2">
                {data.context.events.map((event) => (
                  <li key={event.id} className="break-all border-l-2 border-border pl-3">
                    {event.action} · Version {event.version} · {date(event.occurredAt)} (Dubai) ·{' '}
                    {event.actorId}
                  </li>
                ))}
              </ol>
              {!data.context.events.length && <p>No reference history recorded.</p>}
            </details>
          </>
        )}
      </DetailSection>
    </div>
  );
}