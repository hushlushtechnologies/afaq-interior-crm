'use client';

import { startTransition, useEffect, useId, useRef, useState } from 'react';
import { DetailSection } from '@/components/layout/detail-section';
import { FormField } from '@/components/forms/form-field';
import { FormErrorSummary, type FormSummaryError } from '@/components/forms/form-error-summary';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { loadManualActivities, submitManualActivity } from '@/features/follow-ups/actions';
import {
  manualActivityCommandSchema,
  manualActivityKindSchema,
  type ManualActivityCommand,
} from '@/features/follow-ups/schemas';
import type { ManualActivityPage } from '@/features/follow-ups/contracts';
import { fromDubaiInput } from '@/features/lead-visits/schemas';
import type { Result } from '@/features/leads/schemas';

const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export function LeadManualActivities({ leadId }: { leadId: string }) {
  const [result, setResult] = useState<Result<ManualActivityPage> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState('');
  const [errors, setErrors] = useState<FormSummaryError[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({
    kind: 'call',
    summary: '',
    occurred_at: '',
    outcome: '',
    notes: '',
  });

  const prefix = useId();
  const summary = useRef<HTMLDivElement>(null);
  const flight = useRef(false);
  const reading = useRef(false);
  const request = useRef<ManualActivityCommand | null>(null);
  const editorLocked = busy || uncertain;
  const locked = loading || open || result === null;

  useEffect(() => {
    let active = true;

    void loadManualActivities({ leadId, page: 0 })
      .then((response) => {
        if (active) setResult(response);
      })
      .catch(() => {
        if (active)
          setResult({
            status: 'error',
            message: 'Recorded activities could not be loaded. Retry loading.',
            retryable: true,
          });
      });

    return () => {
      active = false;
    };
  }, [leadId]);

  async function reload(next = page) {
    if (reading.current) return;

    reading.current = true;
    setLoading(true);

    try {
      setResult(await loadManualActivities({ leadId, page: next }));
      setPage(next);
    } catch {
      setResult({
        status: 'error',
        message: 'Recorded activities could not be loaded. Retry loading.',
        retryable: true,
      });
    } finally {
      reading.current = false;
      setLoading(false);
    }
  }

  async function execute(command: ManualActivityCommand) {
    if (flight.current) return;

    flight.current = true;
    request.current = command;
    setBusy(true);
    setMessage('');

    try {
      const response = await submitManualActivity(command);

      if (response.status === 'ok') {
        request.current = null;
        setUncertain(false);
        setOpen(false);
        setSaved('Manual activity recorded. No message was sent by this application.');
        await reload(0);
      } else {
        setMessage(response.message);
        setUncertain(response.retryable);

        if (!response.retryable) request.current = null;
      }
    } catch {
      setMessage('The result could not be confirmed. Retry the same unchanged request.');
      setUncertain(true);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }

  function save() {
    if (editorLocked || flight.current) return;

    const parsed = manualActivityCommandSchema.safeParse({
      leadId,
      activityId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      command: 'log',
      data: {
        kind: draft.kind,
        summary: draft.summary,
        occurred_at: fromDubaiInput(draft.occurred_at),
        outcome: draft.outcome || null,
        notes: draft.notes || null,
      },
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

  return (
    <div className="mx-auto mt-6 max-w-7xl">
      <DetailSection
        id="lead-manual-activities"
        title="Recorded sales activities"
        description="Employee-entered communication logs and completed follow-ups. Existing notes, site visits and pipeline history remain in their own sections."
        actions={
          <div className="flex flex-wrap gap-2">
            {result?.status === 'ok' && !result.data.readOnly && (
              <Button
                disabled={locked || busy}
                onClick={() => {
                  setDraft({ kind: 'call', summary: '', occurred_at: '', outcome: '', notes: '' });
                  setErrors([]);
                  setMessage('');
                  setUncertain(false);
                  request.current = null;
                  setOpen(true);
                }}
              >
                Log manual activity
              </Button>
            )}

            <Button
              variant="outline"
              disabled={locked || busy}
              onClick={() =>
                startTransition(() => {
                  void reload();
                })
              }
            >
              Reload recorded activities
            </Button>
          </div>
        }
      >
        {(result === null || loading) && <p role="status">Loading recorded activities…</p>}

        {saved && (
          <p role="status" className="mb-3 text-sm">
            {saved}
          </p>
        )}

        {result?.status === 'error' && <p role="alert">{result.message}</p>}

        {result?.status === 'ok' && (
          <>
            <p role="status" className="mb-4 text-sm text-muted-foreground">
              Activities page {page + 1}: {result.data.rows.length} of {result.data.total}. Times
              use Asia/Dubai.
            </p>

            {result.data.readOnly && (
              <p className="mb-3 text-sm">
                Activity logging is read-only for this lead or account.
              </p>
            )}

            {result.data.rows.length === 0 && <p>No recorded activities on this page.</p>}

            <ol className="space-y-4">
              {result.data.rows.map((activity) => (
                <li key={activity.id} className="space-y-2 border-l-2 border-border pl-4">
                  <h3 className="break-words font-semibold">{activity.summary}</h3>

                  <p className="text-sm">
                    {activity.kind === 'follow_up'
                      ? 'Follow-up completion'
                      : `Manual ${activity.kind} log`}{' '}
                    · {time(activity.occurred_at)} (Dubai)
                  </p>

                  <p className="break-all text-xs text-muted-foreground">
                    Recorded by {activity.created_by} · {time(activity.created_at)} (Dubai)
                  </p>

                  {activity.outcome && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      Outcome: {activity.outcome}
                    </p>
                  )}

                  {activity.notes && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      Internal notes: {activity.notes}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {activity.kind === 'follow_up'
                      ? 'Recorded when an employee completed a follow-up task.'
                      : 'Employee record; application delivery is not confirmed.'}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={locked || busy || page === 0}
                onClick={() =>
                  startTransition(() => {
                    void reload(page - 1);
                  })
                }
              >
                Previous activity page
              </Button>

              <Button
                variant="outline"
                disabled={locked || busy || (page + 1) * 20 >= result.data.total}
                onClick={() =>
                  startTransition(() => {
                    void reload(page + 1);
                  })
                }
              >
                Next activity page
              </Button>
            </div>
          </>
        )}
      </DetailSection>

      {open && (
        <Dialog
          open
          dismissible={!editorLocked}
          onOpenChange={(value) => {
            if (!value && !editorLocked) setOpen(false);
          }}
          title="Log manual activity"
          description="Record an actual employee communication. This form sends no email or WhatsApp message. Saved records cannot be edited."
        >
          <form
            noValidate
            className="space-y-4"
            aria-label="Manual activity editor"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <FormErrorSummary ref={summary} errors={errors} />

            {(
              [
                ['kind', 'Activity type', 'select'],
                ['summary', 'Activity summary', 'text'],
                ['occurred_at', 'Actual activity time (Dubai)', 'datetime-local'],
                ['outcome', 'Activity outcome', 'textarea'],
                ['notes', 'Internal activity notes', 'textarea'],
              ] as const
            ).map(([key, title, type]) => (
              <FormField
                key={key}
                id={`${prefix}-${key}`}
                label={title}
                disabled={editorLocked}
                required={key !== 'outcome' && key !== 'notes'}
                error={errors.find((error) => error.fieldId === `${prefix}-${key}`)?.message}
              >
                {(control) =>
                  type === 'select' ? (
                    <NativeSelect
                      {...control}
                      value={draft[key]}
                      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                    >
                      {manualActivityKindSchema.options.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
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

            {message && <p role="alert">{message}</p>}

            {uncertain && (
              <p className="text-sm">
                Keep this dialog open and retry. Refreshing or navigating away loses the retry
                request held in this tab.
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
                  Retry same activity request
                </Button>
              ) : (
                <Button type="submit" loading={busy}>
                  Save manual activity
                </Button>
              )}

              <Button variant="outline" disabled={editorLocked} onClick={() => setOpen(false)}>
                Close activity editor
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
