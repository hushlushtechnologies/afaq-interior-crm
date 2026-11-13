'use client';

import { useId, useRef, useState } from 'react';
import { FormField } from '@/components/forms/form-field';
import { FormErrorSummary, type FormSummaryError } from '@/components/forms/form-error-summary';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { submitLeadDetail } from '@/features/lead-details/actions';
import type { DetailRecord } from '@/features/lead-details/contracts';
import { detailCommandSchema, type DetailCommand } from '@/features/lead-details/schemas';

type Field = readonly [string, string, 'text' | 'textarea' | 'date' | 'number' | 'state'];
const fields: Record<DetailRecord['kind'], readonly Field[]> = {
  requirements: [
    ['project_type', 'Interior project type', 'text'],
    ['property_type', 'Property type', 'text'],
    ['location_description', 'Requirement location', 'text'],
    ['style_preferences', 'Design preferences', 'textarea'],
    ['material_preferences', 'Material preferences', 'textarea'],
    ['furniture_preferences', 'Furniture preferences', 'textarea'],
    ['color_preferences', 'Color preferences', 'textarea'],
    ['budget_estimate', 'Requirement budget estimate (AED)', 'text'],
    ['desired_start_date', 'Desired start date', 'date'],
    ['desired_completion_date', 'Desired completion date', 'date'],
    ['special_instructions', 'Special instructions', 'textarea'],
    ['completion_state', 'Requirement status', 'state'],
  ],
  room: [
    ['name', 'Room or space name', 'text'],
    ['room_type', 'Room type', 'text'],
    ['sort_order', 'Display order', 'number'],
    ['requirements_notes', 'Room requirements', 'textarea'],
    ['measurement_notes', 'Measurements and units (unverified notes)', 'textarea'],
    ['deliverables_notes', 'Room deliverables', 'textarea'],
  ],
  note: [['body', 'Internal note', 'textarea']],
};
export const detailTitles = {
  requirements: 'Requirements',
  room: 'Rooms and scope',
  note: 'Internal notes',
};

export function LeadDetailEditor({
  leadId,
  kind,
  record,
  onClose,
  onSaved,
}: {
  leadId: string;
  kind: DetailRecord['kind'];
  record: DetailRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const prefix = useId();
  const [draft, setDraft] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(fields[kind].map(([key]) => [key, ''])),
    ...(kind === 'requirements' ? { currency: 'AED', completion_state: 'not_started' } : {}),
    ...(kind === 'room' ? { sort_order: '0' } : {}),
    ...Object.fromEntries(
      Object.entries(record?.data ?? {}).map(([key, value]) => [
        key,
        value === null ? '' : String(value),
      ]),
    ),
  }));
  const [errors, setErrors] = useState<FormSummaryError[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const request = useRef<DetailCommand | null>(null);
  const flight = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  const locked = busy || uncertain;

  async function execute(command: DetailCommand) {
    if (flight.current) return;
    flight.current = true;
    request.current = command;
    setBusy(true);
    setMessage('');
    try {
      const result = await submitLeadDetail(command);
      if (result.status === 'ok') {
        onSaved();
      } else {
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
    const data = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [
        key,
        key === 'sort_order'
          ? value.trim()
            ? Number(value)
            : NaN
          : key === 'name' || key === 'body'
            ? value
            : value || null,
      ]),
    );
    const parsed = detailCommandSchema.safeParse({
      command: `save_${kind}`,
      requestId: crypto.randomUUID(),
      leadId,
      version: record?.version ?? null,
      ...(kind === 'requirements' ? {} : { recordId: record?.id ?? crypto.randomUUID() }),
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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      dismissible={!locked}
      title={`${record ? 'Edit' : 'Add'} ${kind === 'room' ? 'room' : kind === 'note' ? 'internal note' : 'requirements'}`}
      description="Unknown details may remain blank. Changes are recorded in internal history."
    >
      <form
        noValidate
        aria-label={`${detailTitles[kind]} editor`}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <FormErrorSummary ref={summary} errors={errors} />
        {fields[kind].map(([key, label, type]) => (
          <FormField
            key={key}
            id={`${prefix}-${key}`}
            label={label}
            disabled={locked}
            required={key === 'name' || key === 'body'}
            error={errors.find((error) => error.fieldId === `${prefix}-${key}`)?.message}
          >
            {(control) =>
              type === 'state' ? (
                <NativeSelect
                  {...control}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                >
                  {['not_started', 'in_progress', 'completed', 'needs_clarification'].map(
                    (state) => (
                      <option key={state} value={state}>
                        {state.replaceAll('_', ' ')}
                      </option>
                    ),
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
            <Button
              disabled={busy}
              loading={busy}
              onClick={() => request.current && void execute(request.current)}
            >
              Retry same detail request
            </Button>
          ) : (
            <Button type="submit" loading={busy}>
              Save details
            </Button>
          )}
          <Button variant="outline" disabled={locked} onClick={onClose}>
            Cancel detail editing
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
