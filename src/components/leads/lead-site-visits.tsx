'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useAccess } from '@/components/access/access-provider';
import { DetailSection } from '@/components/layout/detail-section';
import { FormField } from '@/components/forms/form-field';
import { FormErrorSummary, type FormSummaryError } from '@/components/forms/form-error-summary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { loadSiteVisits, submitSiteVisit } from '@/features/lead-visits/actions';
import {
  fromDubaiInput,
  toDubaiInput,
  visitCommandSchema,
  type VisitCommand,
  type VisitPage,
  type VisitRow,
} from '@/features/lead-visits/schemas';
import type { Result } from '@/features/leads/schemas';

const displayTime = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
type Mode = VisitCommand['command'];
function VisitEditor({
  leadId,
  mode,
  visit,
  owner,
  onClose,
  onSaved,
}: {
  leadId: string;
  mode: Mode;
  visit: VisitRow | null;
  owner: VisitPage['owner'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const prefix = useId();
  const [draft, setDraft] = useState<Record<string, string>>({
    scheduled_at: visit ? toDubaiInput(visit.scheduled_at) : '',
    assigned_user_id: visit?.assigned_user_id ?? '',
    location: visit?.location ?? '',
    notes: visit?.notes ?? '',
    measurements: visit?.measurements ?? '',
    observations: visit?.observations ?? '',
    actual_at: '',
    outcome: '',
    reason: '',
  });
  const [errors, setErrors] = useState<FormSummaryError[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const request = useRef<VisitCommand | null>(null);
  const flight = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  const locked = busy || uncertain;
  async function execute(command: VisitCommand) {
    if (flight.current) return;
    flight.current = true;
    request.current = command;
    setBusy(true);
    setMessage('');
    try {
      const result = await submitSiteVisit(command);
      if (result.status === 'ok') onSaved();
      else {
        setMessage(result.message);
        setUncertain(result.retryable);
        if (!result.retryable) request.current = null;
      }
    } catch {
      setMessage('The result could not be confirmed. Retry the same request.');
      setUncertain(true);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  function save() {
    if (locked || flight.current) return;
    const data =
      mode === 'complete'
        ? { actual_at: fromDubaiInput(draft.actual_at), outcome: draft.outcome }
        : mode === 'cancel'
          ? { reason: draft.reason }
          : {
              scheduled_at:
                visit && draft.scheduled_at === toDubaiInput(visit.scheduled_at)
                  ? visit.scheduled_at
                  : fromDubaiInput(draft.scheduled_at),
              assigned_user_id: draft.assigned_user_id || null,
              location: draft.location || null,
              notes: draft.notes || null,
              measurements: draft.measurements || null,
              observations: draft.observations || null,
            };
    const parsed = visitCommandSchema.safeParse({
      command: mode,
      requestId: crypto.randomUUID(),
      leadId,
      visitId: visit?.id ?? crypto.randomUUID(),
      version: visit?.version ?? null,
      data,
    });
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((issue) => ({
          fieldId: `${prefix}-${String(issue.path.at(-1))}`,
          message: issue.message,
        })),
      );
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setErrors([]);
    void execute(parsed.data);
  }
  const fields =
    mode === 'complete'
      ? [
          ['actual_at', 'Actual visit time (Dubai)', 'datetime-local'],
          ['outcome', 'Visit outcome', 'textarea'],
        ]
      : mode === 'cancel'
        ? [['reason', 'Cancellation reason', 'textarea']]
        : [
            ['scheduled_at', 'Scheduled visit time (Dubai)', 'datetime-local'],
            ['assigned_user_id', 'Assigned visit employee', 'owner'],
            ['location', 'Visit location', 'text'],
            ['notes', 'Visit notes', 'textarea'],
            ['measurements', 'Visit measurements (unverified)', 'textarea'],
            ['observations', 'Site observations', 'textarea'],
          ];
  return (
    <Dialog
      open
      dismissible={!locked}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      title={`${mode === 'create' ? 'Create' : mode === 'update' ? 'Edit' : mode === 'complete' ? 'Complete' : 'Cancel'} site visit`}
      description="Times use Asia/Dubai. Completed and cancelled visits cannot be edited or reopened."
    >
      <form
        noValidate
        aria-label="Site visit editor"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <FormErrorSummary ref={summary} errors={errors} />
        {fields.map(([key, label, type]) => (
          <FormField
            key={key}
            id={`${prefix}-${key}`}
            label={label}
            disabled={locked}
            required={['scheduled_at', 'actual_at', 'outcome', 'reason'].includes(key)}
            error={errors.find((error) => error.fieldId === `${prefix}-${key}`)?.message}
          >
            {(control) =>
              type === 'owner' ? (
                <NativeSelect
                  {...control}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                >
                  <option value="">Unassigned</option>
                  {owner && <option value={owner.id}>{owner.name}</option>}
                  {visit?.assigned_user_id && visit.assigned_user_id !== owner?.id && (
                    <option value={visit.assigned_user_id}>
                      Recorded assignment (review required)
                    </option>
                  )}
                </NativeSelect>
              ) : type === 'textarea' ? (
                <Textarea
                  {...control}
                  rows={4}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              ) : (
                <Input
                  {...control}
                  type={type}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              )
            }
          </FormField>
        ))}
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {uncertain ? (
            <Button loading={busy} onClick={() => request.current && void execute(request.current)}>
              Retry same visit request
            </Button>
          ) : (
            <Button type="submit" loading={busy}>
              Save visit
            </Button>
          )}
          <Button variant="outline" disabled={locked} onClick={onClose}>
            Cancel visit editing
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function LeadSiteVisits({
  leadId,
  locked,
  acquire,
  release,
}: {
  leadId: string;
  locked: boolean;
  acquire: () => boolean;
  release: () => void;
}) {
  const { snapshot } = useAccess();
  const [result, setResult] = useState<Result<VisitPage> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState<{ mode: Mode; visit: VisitRow | null } | null>(null);
  useEffect(() => {
    let active = true;
    void loadSiteVisits({ leadId, page: 0 })
      .then((response) => {
        if (active) setResult(response);
      })
      .catch(() => {
        if (active)
          setResult({
            status: 'error',
            message: 'Site visits could not be loaded. Retry loading.',
            retryable: true,
          });
      });
    return () => {
      active = false;
    };
  }, [leadId]);
  async function reload(next = page) {
    if (!acquire()) return;
    setLoading(true);
    try {
      setResult(await loadSiteVisits({ leadId, page: next }));
      setPage(next);
    } catch {
      setResult({
        status: 'error',
        message: 'Site visits could not be loaded. Retry loading.',
        retryable: true,
      });
    } finally {
      setLoading(false);
      release();
    }
  }
  function edit(mode: Mode, visit: VisitRow | null) {
    if (acquire()) setEditor({ mode, visit });
  }
  function close(saved: boolean) {
    setEditor(null);
    release();
    if (saved) {
      setMessage('Site visit saved. History retained.');
      void reload(0);
    }
  }
  return (
    <DetailSection
      id="lead-site-visits"
      title="Site visits"
      description="Scheduled visits and recorded outcomes. No customer notification is sent."
      actions={
        <div className="flex flex-wrap gap-2">
          {result?.status === 'ok' && !result.data.readOnly && (
            <Button disabled={locked} onClick={() => edit('create', null)}>
              Add site visit
            </Button>
          )}
          <Button
            variant="outline"
            disabled={locked || result === null}
            onClick={() => void reload()}
          >
            Reload site visits
          </Button>
        </div>
      }
    >
      {(result === null || loading) && <p role="status">Loading site visits…</p>}
      {message && (
        <p role="status" className="mb-3 text-sm">
          {message}
        </p>
      )}
      {result?.status === 'error' && <p role="alert">{result.message}</p>}
      {result?.status === 'ok' && (
        <>
          <p role="status" className="mb-4 text-sm text-muted-foreground">
            Site visits page {page + 1}: {result.data.rows.length} of {result.data.total}
          </p>
          {result.data.readOnly && (
            <p className="mb-3 text-sm">Site visits are read-only for this lead or account.</p>
          )}
          {result.data.rows.length === 0 && <p>No site visits recorded on this page.</p>}
          <div className="space-y-4">
            {result.data.rows.map((visit) => (
              <article
                key={visit.id}
                data-testid={`visit-${visit.id}`}
                className="min-w-0 space-y-3 rounded-control border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold">{displayTime(visit.scheduled_at)} (Dubai)</h3>
                  <Badge
                    tone={
                      visit.status === 'completed'
                        ? 'success'
                        : visit.status === 'planned'
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {visit.status}
                  </Badge>
                </div>
                <p className="break-all text-sm">
                  Assigned employee:{' '}
                  {visit.assigned_user_id === snapshot.userId
                    ? 'You'
                    : (visit.assigned_user_id ?? 'Unassigned')}
                </p>
                {visit.needs_assignment_review && (
                  <p role="status" className="rounded-control bg-muted p-3 text-sm">
                    Assignment requires review: the recorded employee is no longer the current
                    active Sales owner.
                  </p>
                )}
                {(
                  [
                    'location',
                    'notes',
                    'measurements',
                    'observations',
                    'outcome',
                    'cancellation_reason',
                  ] as const
                ).map(
                  (key) =>
                    visit[key] && (
                      <p key={key} className="whitespace-pre-wrap break-words text-sm">
                        <strong>{key.replaceAll('_', ' ')}:</strong> {visit[key]}
                      </p>
                    ),
                )}
                {visit.actual_at && (
                  <p className="text-sm">Actual visit: {displayTime(visit.actual_at)} (Dubai)</p>
                )}
                <p className="break-all text-xs text-muted-foreground">
                  Created by {visit.created_by === snapshot.userId ? 'You' : visit.created_by} ·{' '}
                  {displayTime(visit.created_at)} (Dubai) · Version {visit.version}
                </p>
                <p className="break-all text-xs text-muted-foreground">
                  Updated by {visit.updated_by === snapshot.userId ? 'You' : visit.updated_by} ·{' '}
                  {displayTime(visit.updated_at)} (Dubai)
                </p>
                {visit.finalized_at && (
                  <p className="break-all text-xs text-muted-foreground">
                    {visit.status} by{' '}
                    {visit.finalized_by === snapshot.userId ? 'You' : visit.finalized_by} ·{' '}
                    {displayTime(visit.finalized_at)} (Dubai)
                  </p>
                )}
                {!result.data.readOnly && visit.status === 'planned' && (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      disabled={locked}
                      onClick={() => edit('update', visit)}
                    >
                      Edit site visit
                    </Button>
                    <Button disabled={locked} onClick={() => edit('complete', visit)}>
                      Complete site visit
                    </Button>
                    <Button
                      variant="outline"
                      disabled={locked}
                      onClick={() => edit('cancel', visit)}
                    >
                      Cancel site visit
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={locked || page === 0}
              onClick={() => void reload(page - 1)}
            >
              Previous visit page
            </Button>
            <Button
              variant="outline"
              disabled={locked || (page + 1) * 20 >= result.data.total}
              onClick={() => void reload(page + 1)}
            >
              Next visit page
            </Button>
          </div>
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer font-medium">
              Site visit history — latest 50 events
            </summary>
            <p className="my-3">Older events remain stored. Times use Asia/Dubai.</p>
            <ol className="space-y-3">
              {result.data.events.map((event) => (
                <li key={event.id} className="border-l-2 border-border pl-3">
                  <p className="break-all">
                    {event.actions.join(', ').replaceAll('_', ' ')} ·{' '}
                    {displayTime(event.occurred_at)} ·{' '}
                    {event.actor_id === snapshot.userId ? 'You' : event.actor_id}
                  </p>
                  <p>
                    Status: {event.before_data?.status ?? 'New record'} → {event.after_data.status}
                  </p>
                </li>
              ))}
            </ol>
          </details>
          {editor && (
            <VisitEditor
              leadId={leadId}
              mode={editor.mode}
              visit={editor.visit}
              owner={result.data.owner}
              onClose={() => close(false)}
              onSaved={() => close(true)}
            />
          )}
        </>
      )}
    </DetailSection>
  );
}