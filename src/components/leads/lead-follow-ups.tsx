'use client';

import { startTransition, useEffect, useId, useRef, useState } from 'react';
import { useAccess } from '@/components/access/access-provider';
import { DetailSection } from '@/components/layout/detail-section';
import { FormField } from '@/components/forms/form-field';
import { FormErrorSummary, type FormSummaryError } from '@/components/forms/form-error-summary';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { hasRequiredScope } from '@/features/access/permissions';
import { loadFollowUps, submitFollowUp } from '@/features/follow-ups/actions';
import {
  followUpCommandSchema,
  followUpTimeFlags,
  type FollowUpCommand,
} from '@/features/follow-ups/schemas';
import { followUpViewSchema, type FollowUpPage } from '@/features/follow-ups/contracts';
import { fromDubaiInput, toDubaiInput } from '@/features/lead-visits/schemas';
import type { LeadRow, Result } from '@/features/leads/schemas';

type Row = FollowUpPage['rows'][number];
type View = 'all' | 'open' | 'today' | 'overdue' | 'upcoming' | 'completed' | 'cancelled';

const label = (value: string) => value.replaceAll('_', ' ');

const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

function Editor({
  lead,
  mode,
  row,
  onClose,
  onSaved,
}: {
  lead: LeadRow;
  mode: FollowUpCommand['command'];
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const prefix = useId();
  const [draft, setDraft] = useState<Record<string, string>>({
    title: row?.title ?? '',
    description: row?.description ?? '',
    kind: row?.kind ?? 'call',
    priority: row?.priority ?? 'normal',
    due_at: row ? toDubaiInput(row.due_at) : '',
    actual_at: '',
    outcome: '',
    reason: '',
  });
  const [errors, setErrors] = useState<FormSummaryError[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const flight = useRef(false);
  const request = useRef<FollowUpCommand | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const locked = busy || uncertain;

  async function execute(command: FollowUpCommand) {
    if (flight.current) return;

    flight.current = true;
    request.current = command;
    setBusy(true);
    setMessage('');

    try {
      const result = await submitFollowUp(command);

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

    const details = {
      title: draft.title,
      description: draft.description || null,
      kind: draft.kind,
      priority: draft.priority,
      assigned_user_id: row?.current_owner_id ?? lead.assigned_user_id,
    };

    const due =
      row && draft.due_at === toDubaiInput(row.due_at) ? row.due_at : fromDubaiInput(draft.due_at);

    const data =
      mode === 'complete'
        ? { actual_at: fromDubaiInput(draft.actual_at), outcome: draft.outcome }
        : mode === 'cancel'
          ? { reason: draft.reason }
          : mode === 'reschedule'
            ? { due_at: due, reason: draft.reason }
            : mode === 'update'
              ? details
              : { ...details, due_at: due };

    const parsed = followUpCommandSchema.safeParse({
      command: mode,
      requestId: crypto.randomUUID(),
      leadId: lead.id,
      followUpId: row?.id ?? crypto.randomUUID(),
      version: row?.version ?? null,
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

    startTransition(() => {
      void execute(parsed.data);
    });
  }

  const fields =
    mode === 'complete'
      ? [
          ['actual_at', 'Actual follow-up time (Dubai)', 'datetime-local'],
          ['outcome', 'Follow-up outcome', 'textarea'],
        ]
      : mode === 'cancel'
        ? [['reason', 'Cancellation reason', 'textarea']]
        : mode === 'reschedule'
          ? [
              ['due_at', 'Follow-up due time (Dubai)', 'datetime-local'],
              ['reason', 'Reschedule reason', 'textarea'],
            ]
          : [
              ['title', 'Follow-up title', 'text'],
              ['description', 'Follow-up description', 'textarea'],
              ['kind', 'Follow-up type', 'kind'],
              ['priority', 'Follow-up priority', 'priority'],
              ...(mode === 'create'
                ? [['due_at', 'Follow-up due time (Dubai)', 'datetime-local']]
                : []),
            ];

  return (
    <Dialog
      open
      dismissible={!locked}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      title={`${label(mode)} follow-up`}
      description="Times use Asia/Dubai. Completed and cancelled tasks cannot be reopened."
    >
      <form
        noValidate
        aria-label="Follow-up editor"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <FormErrorSummary ref={summary} errors={errors} />

        {fields.map(([key, title, type]) => (
          <FormField
            key={key}
            id={`${prefix}-${key}`}
            label={title}
            disabled={locked}
            required={key !== 'description'}
            error={errors.find((error) => error.fieldId === `${prefix}-${key}`)?.message}
          >
            {(control) =>
              type === 'kind' || type === 'priority' ? (
                <NativeSelect
                  {...control}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                >
                  {(type === 'kind'
                    ? ['call', 'meeting', 'site_visit', 'whatsapp', 'email', 'follow_up']
                    : ['low', 'normal', 'high', 'urgent']
                  ).map((value) => (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ))}
                </NativeSelect>
              ) : type === 'textarea' ? (
                <Textarea
                  {...control}
                  rows={3}
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

        {(mode === 'create' || mode === 'update') && (
          <p className="text-sm text-muted-foreground">
            Saving assigns this task to the lead’s current active Sales owner. Eligibility is
            checked on the server.
          </p>
        )}

        {message && <p role="alert">{message}</p>}

        {uncertain && (
          <p className="text-sm">
            Keep this dialog open and retry. Refreshing loses the retry request held in this tab.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {uncertain ? (
            <Button
              loading={busy}
              onClick={() =>
                startTransition(() => {
                  if (request.current) void execute(request.current);
                })
              }
            >
              Retry same follow-up request
            </Button>
          ) : (
            <Button type="submit" loading={busy}>
              Save follow-up
            </Button>
          )}

          <Button variant="outline" disabled={locked} onClick={onClose}>
            Close follow-up editor
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function LeadFollowUps({ lead }: { lead: LeadRow }) {
  const { snapshot } = useAccess();

  const writable =
    !lead.archived_at &&
    lead.stage !== 'lost' &&
    (hasRequiredScope(snapshot, 'leads.update', 'company') ||
      (lead.assigned_user_id === snapshot.userId &&
        hasRequiredScope(snapshot, 'leads.update', 'assigned')) ||
      (lead.created_by === snapshot.userId && hasRequiredScope(snapshot, 'leads.update', 'own')));

  const [result, setResult] = useState<Result<FollowUpPage> | null>(null);
  const [view, setView] = useState<View>('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState<{
    mode: FollowUpCommand['command'];
    row: Row | null;
  } | null>(null);

  const gate = useRef(false);
  const filterId = useId();

  useEffect(() => {
    let active = true;

    void loadFollowUps({ leadId: lead.id, page: 0, view: 'all', mine: false })
      .then((response) => {
        if (active) setResult(response);
      })
      .catch(() => {
        if (active)
          setResult({
            status: 'error',
            message: 'Follow-ups could not be loaded. Retry loading.',
            retryable: true,
          });
      });

    return () => {
      active = false;
    };
  }, [lead.id]);

  async function reload(next = page, nextView = view) {
    if (gate.current) return;

    gate.current = true;
    setLoading(true);

    try {
      setResult(await loadFollowUps({ leadId: lead.id, page: next, view: nextView, mine: false }));
      setPage(next);
      setView(nextView);
    } catch {
      setResult({
        status: 'error',
        message: 'Follow-ups could not be loaded. Retry loading.',
        retryable: true,
      });
    } finally {
      gate.current = false;
      setLoading(false);
    }
  }

  const locked = loading || editor !== null || result === null;

  function edit(mode: FollowUpCommand['command'], row: Row | null) {
    if (locked || gate.current) return;

    gate.current = true;
    setEditor({ mode, row });
  }

  return (
    <div className="mx-auto mt-6 max-w-7xl">
      <DetailSection
        id="lead-follow-ups"
        title="Lead follow-ups"
        description="Employee tasks and recorded outcomes. Scheduling does not send a message or create a reminder."
        actions={
          <div className="flex flex-wrap gap-2">
            {writable && lead.assigned_user_id && result?.status === 'ok' && (
              <Button disabled={locked} onClick={() => edit('create', null)}>
                Add follow-up
              </Button>
            )}

            <Button
              variant="outline"
              disabled={locked}
              onClick={() =>
                startTransition(() => {
                  void reload();
                })
              }
            >
              Reload follow-ups
            </Button>
          </div>
        }
      >
        <div className="mb-4 max-w-xs">
          <label htmlFor={filterId} className="text-sm">
            Follow-up view
          </label>
          <NativeSelect
            id={filterId}
            disabled={locked}
            value={view}
            onChange={(event) => {
              const next = followUpViewSchema.parse(event.target.value);

              startTransition(() => {
                void reload(0, next);
              });
            }}
          >
            {followUpViewSchema.options.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </NativeSelect>
        </div>

        {!lead.assigned_user_id && writable && (
          <p>Assign an active Sales owner to the lead before creating a follow-up.</p>
        )}

        {(result === null || loading) && <p role="status">Loading follow-ups…</p>}
        {message && <p role="status">{message}</p>}
        {result?.status === 'error' && <p role="alert">{result.message}</p>}

        {result?.status === 'ok' && (
          <>
            <p className="mb-4 text-sm text-muted-foreground" role="status">
              Follow-ups page {page + 1}: {result.data.rows.length} of {result.data.total}. As of{' '}
              {time(result.data.asOf)} (Dubai).
            </p>

            {result.data.rows.length === 0 && <p>No follow-ups in this view.</p>}

            <div className="space-y-4">
              {result.data.rows.map((row) => {
                const flags = followUpTimeFlags(row.due_at, row.status, result.data.asOf);

                return (
                  <article
                    key={row.id}
                    data-testid={`follow-up-${row.id}`}
                    className="space-y-3 rounded-control border border-border p-4"
                  >
                    <h3 className="font-semibold break-words">{row.title}</h3>

                    <p className="text-sm">
                      {label(row.status)} · {label(row.kind)} · {row.priority}
                      {flags.overdue ? ' · Overdue' : ''}
                    </p>

                    <p className="text-sm">Due {time(row.due_at)} (Dubai)</p>

                    <p className="whitespace-pre-wrap break-words text-sm">
                      {row.description ?? 'No description recorded.'}
                    </p>

                    <p className="break-all text-xs text-muted-foreground">
                      Assigned employee:{' '}
                      {row.assigned_user_id === snapshot.userId ? 'You' : row.assigned_user_id} ·
                      Version {row.version}
                    </p>

                    {row.needs_assignment_review && (
                      <p>
                        Assignment needs review. Edit to reassign explicitly to the current active
                        Sales owner.
                      </p>
                    )}

                    {row.actual_at && (
                      <p className="text-sm">Completed {time(row.actual_at)} (Dubai)</p>
                    )}

                    {(row.outcome || row.cancellation_reason) && (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {row.outcome ?? row.cancellation_reason}
                      </p>
                    )}

                    {!row.read_only && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={locked || !row.current_owner_id}
                          onClick={() => edit('update', row)}
                        >
                          Edit follow-up
                        </Button>

                        <Button
                          variant="outline"
                          disabled={locked || row.needs_assignment_review}
                          onClick={() => edit('reschedule', row)}
                        >
                          Reschedule follow-up
                        </Button>

                        <Button
                          variant="outline"
                          disabled={locked || row.needs_assignment_review}
                          onClick={() => edit('complete', row)}
                        >
                          Complete follow-up
                        </Button>

                        <Button
                          variant="outline"
                          disabled={locked}
                          onClick={() => edit('cancel', row)}
                        >
                          Cancel follow-up
                        </Button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="my-4 flex gap-3">
              <Button
                variant="outline"
                disabled={locked || page === 0}
                onClick={() =>
                  startTransition(() => {
                    void reload(page - 1);
                  })
                }
              >
                Previous follow-up page
              </Button>

              <Button
                variant="outline"
                disabled={locked || (page + 1) * 20 >= result.data.total}
                onClick={() =>
                  startTransition(() => {
                    void reload(page + 1);
                  })
                }
              >
                Next follow-up page
              </Button>
            </div>

            <details>
              <summary className="cursor-pointer">Follow-up history — latest 50 events</summary>

              <p className="my-2 text-sm text-muted-foreground">
                History covers all follow-up states for this lead. Older events remain stored.
              </p>

              <ol className="space-y-3">
                {result.data.events.map((event) => (
                  <li key={event.id} className="border-l-2 border-border pl-3 text-sm">
                    <p>
                      {event.actions.map(label).join(', ')} · {time(event.occurred_at)} (Dubai)
                    </p>
                    <p className="break-all">
                      Actor: {event.actor_id === snapshot.userId ? 'You' : event.actor_id}
                    </p>
                    {event.reason && (
                      <p className="whitespace-pre-wrap break-words">{event.reason}</p>
                    )}
                    <p className="break-words">
                      {event.after_data.title} · {event.before_data?.status ?? 'Not recorded'} →{' '}
                      {event.after_data.status}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          </>
        )}

        {editor && (
          <Editor
            lead={lead}
            mode={editor.mode}
            row={editor.row}
            onClose={() => {
              gate.current = false;
              setEditor(null);
            }}
            onSaved={() => {
              gate.current = false;
              setEditor(null);
              setMessage('Follow-up saved. History retained.');

              startTransition(() => {
                void reload(0);
              });
            }}
          />
        )}
      </DetailSection>
    </div>
  );
}
