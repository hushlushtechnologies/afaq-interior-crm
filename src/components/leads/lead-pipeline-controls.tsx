'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/forms/form-field';
import { loadPipelineDetail, submitPipeline } from '@/features/leads/pipeline-actions';
import type { PipelineCommand, PipelineDetail } from '@/features/leads/pipeline-schemas';
import { pipelineCommandSchema } from '@/features/leads/pipeline-schemas';
import type { LeadRow, LeadSave, Result } from '@/features/leads/schemas';
import { DEMO_STAGES } from '@/lib/demo/stages';
import type { DemoStage } from '@/types/demo-crm';

export function LeadPipelineControls({
  row,
  canMove,
  canOutcome,
  disabled = false,
  initialStage,
  onLock,
  onSaved,
}: {
  row: LeadRow;
  canMove: boolean;
  canOutcome: boolean;
  disabled?: boolean;
  initialStage?: DemoStage;
  onLock: (locked: boolean) => void;
  onSaved: (result: LeadSave) => void;
}) {
  const [detail, setDetail] = useState<Result<PipelineDetail> | null>(null);
  const [stage, setStage] = useState(initialStage ?? row.stage);
  const [reasonCode, setReasonCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<Result<LeadSave> | null>(null);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const request = useRef<PipelineCommand | null>(null);
  const uncertain = result?.status === 'error' && result.retryable;
  const locked = busy || Boolean(uncertain);

  useEffect(() => {
    let active = true;

    void loadPipelineDetail(row.id)
      .then((response) => {
        if (active) setDetail(response);
      })
      .catch(() => {
        if (active)
          setDetail({
            status: 'error',
            message: 'Pipeline history could not be loaded.',
            retryable: true,
          });
      });

    return () => {
      active = false;
    };
  }, [row.id]);

  async function execute(command: PipelineCommand) {
    if (flight.current) return;

    flight.current = true;
    request.current = command;
    setBusy(true);
    setResult(null);
    onLock(true);

    try {
      const response = await submitPipeline(command);
      setResult(response);

      if (response.status === 'ok') {
        onLock(false);
        onSaved(response.data);
      } else if (!response.retryable) {
        request.current = null;
        onLock(false);
      }
    } catch {
      setResult({
        status: 'error',
        message: 'The result could not be confirmed. Retry the same request.',
        retryable: true,
      });
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }

  function submit(command: 'move' | 'lose' | 'reopen') {
    const data =
      command === 'move'
        ? { stage }
        : command === 'lose'
          ? { reasonCode, explanation: explanation || null, note: note || null }
          : { reason };

    const parsed = pipelineCommandSchema.safeParse({
      command,
      data,
      requestId: crypto.randomUUID(),
      leadId: row.id,
      version: row.version,
    });

    if (!parsed.success) {
      setResult({
        status: 'error',
        message: parsed.error.issues[0]?.message ?? 'Review the pipeline details.',
        retryable: false,
      });
      return;
    }

    void execute(parsed.data);
  }

  const readonly = disabled || locked || Boolean(row.archived_at);

  return (
    <section
      aria-label="Lead pipeline workflow"
      className="mb-6 space-y-4 rounded-card border border-border p-4"
    >
      <h3 className="font-semibold">Pipeline and outcome</h3>

      <p className="text-sm text-muted-foreground">
        Current stage: {DEMO_STAGES.find((item) => item.id === row.stage)?.label}. Quotation shared,
        Negotiation and Won remain unavailable.
      </p>

      {row.stage !== 'lost' && canMove && (
        <div className="space-y-3">
          <FormField id="pipeline-stage" label="Working stage">
            {(control) => (
              <NativeSelect
                {...control}
                id="pipeline-stage"
                value={stage}
                disabled={readonly}
                onChange={(event) => setStage(event.target.value as DemoStage)}
              >
                {DEMO_STAGES.filter((item) =>
                  ['new', 'assigned', 'contacted', 'requirements', 'site-visit'].includes(item.id),
                ).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <Button disabled={readonly || stage === row.stage} onClick={() => submit('move')}>
            Save stage
          </Button>
        </div>
      )}

      {row.stage !== 'lost' && canOutcome && (
        <div className="space-y-3 border-t border-border pt-4">
          <FormField id="pipeline-loss" label="Lost reason">
            {(control) => (
              <NativeSelect
                {...control}
                id="pipeline-loss"
                value={reasonCode}
                disabled={readonly || detail?.status !== 'ok'}
                onChange={(event) => setReasonCode(event.target.value)}
              >
                <option value="">Choose a Lost reason</option>
                {detail?.status === 'ok' &&
                  detail.data.reasons.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
              </NativeSelect>
            )}
          </FormField>

          {reasonCode === 'other' && (
            <FormField id="pipeline-explanation" label="Explain Other" required>
              {(control) => (
                <Textarea
                  {...control}
                  id="pipeline-explanation"
                  disabled={readonly}
                  value={explanation}
                  maxLength={2000}
                  onChange={(event) => setExplanation(event.target.value)}
                />
              )}
            </FormField>
          )}

          <FormField id="pipeline-note" label="Lost internal note (optional)">
            {(control) => (
              <Textarea
                {...control}
                id="pipeline-note"
                disabled={readonly}
                value={note}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </FormField>

          <Button
            variant="destructive"
            disabled={readonly || detail?.status !== 'ok'}
            onClick={() => submit('lose')}
          >
            Mark Lost
          </Button>
        </div>
      )}

      {row.stage === 'lost' && (
        <p className="text-sm">
          Reopen this lead before editing, assigning or changing its working stage.
        </p>
      )}

      {row.stage === 'lost' && canOutcome && (
        <div className="space-y-3">
          <FormField id="pipeline-reopen" label="Reopening reason" required>
            {(control) => (
              <Textarea
                {...control}
                id="pipeline-reopen"
                value={reason}
                maxLength={2000}
                disabled={readonly}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </FormField>

          <Button disabled={readonly} onClick={() => submit('reopen')}>
            Reopen lead
          </Button>
        </div>
      )}

      {result?.status === 'error' && (
        <div role="alert" className="space-y-2">
          <p>{result.message}</p>
          {uncertain && (
            <Button
              loading={busy}
              disabled={busy}
              onClick={() => request.current && void execute(request.current)}
            >
              Retry same pipeline request
            </Button>
          )}
        </div>
      )}

      {detail === null ? (
        <p role="status">Loading pipeline history…</p>
      ) : detail.status === 'error' ? (
        <p role="alert">{detail.message}</p>
      ) : (
        <div className="space-y-3">
          <h4 className="font-medium">Preserved Lost decisions</h4>

          {detail.data.losses.length === 0 && (
            <p className="text-sm text-muted-foreground">No Lost decisions recorded.</p>
          )}

          <ol className="space-y-2">
            {detail.data.losses.map((loss) => (
              <li key={loss.id} className="break-words text-sm">
                {detail.data.reasons.find((item) => item.code === loss.reason_code)?.name ??
                  loss.reason_code}{' '}
                · {new Date(loss.occurred_at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}{' '}
                Dubai · Actor {loss.actor_id}
                {loss.explanation && <p>{loss.explanation}</p>}
                {loss.internal_note && <p>Internal note: {loss.internal_note}</p>}
              </li>
            ))}
          </ol>

          <h4 className="font-medium">Pipeline history</h4>

          <ol className="space-y-2">
            {detail.data.events.map((event) => (
              <li key={event.id} className="break-words text-sm">
                {event.action}: {event.previous_stage} → {event.new_stage} ·{' '}
                {new Date(event.occurred_at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}{' '}
                Dubai · Actor {event.actor_id}
                {event.reason && <p>Reason: {event.reason}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
