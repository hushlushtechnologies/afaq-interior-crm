'use client';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { captureAdmin } from '@/features/lead-capture/admin-actions';
import { PageHeader } from '@/components/layout/page-header';
import { DetailSection } from '@/components/layout/detail-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/forms/form-field';
const connection = z.object({
  id: z.uuid(),
  principal_id: z.uuid(),
  sponsor_id: z.uuid(),
  provider: z.enum(['website', 'meta']),
  source_code: z.enum(['website', 'facebook', 'instagram']),
  binding: z.string(),
  owner_id: z.uuid().nullable(),
  page_id: z.string().nullable(),
  form_id: z.string().nullable(),
  active: z.boolean(),
  expires_at: z.string(),
  version: z.number().int(),
});
const reviewSchema = z.object({
  connections: z.array(connection),
  rows: z.array(
    z.object({
      id: z.uuid(),
      connection_id: z.uuid(),
      state: z.enum(['queued', 'processing', 'held', 'succeeded']),
      attempts: z.number(),
      safe_error: z.string().nullable(),
      resulting_lead_id: z.uuid().nullable(),
      version: z.number(),
      created_at: z.string(),
    }),
  ),
  total: z.number(),
  page: z.number(),
});
export function CaptureWorkspace({
  initial,
  initialMessage,
}: {
  initial: unknown;
  initialMessage: string;
}) {
  const parsedInitial = reviewSchema.safeParse(initial);
  const [data, setData] = useState<z.infer<typeof reviewSchema> | null>(
    parsedInitial.success ? parsedInitial.data : null,
  );
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [message, setMessage] = useState(initialMessage);
  const [editing, setEditing] = useState<z.infer<typeof connection> | null>(null);
  const [owner, setOwner] = useState('');
  const [expires, setExpires] = useState('');
  async function load(next = page) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    try {
      const r = await captureAdmin('review', next);
      if (r.status === 'error') {
        setData(null);
        setMessage(r.message);
      } else {
        setData(reviewSchema.parse(r.data));
        setPage(next);
        setMessage('Review refreshed.');
      }
    } catch {
      setData(null);
      setMessage('Review could not be loaded.');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function perform(action: 'save' | 'retry' | 'process', input: unknown) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    try {
      const r = await captureAdmin(action, input);
      setMessage(
        r.status === 'error' ? r.message : 'Operation recorded. Reload to see the current queue.',
      );
      if (r.status === 'ok') setEditing(null);
    } catch {
      setMessage('Result could not be confirmed. Reload before another action.');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Local lead capture"
        description="Super Admin review of private intake receipts and delegated processing."
      />
      <p className="text-sm text-muted-foreground">
        Local testing only. Meta retrieval uses synthetic provider responses. Live integrations and
        production scheduling are disabled. Credentials are provisioned privately outside this
        screen.
      </p>
      <Button disabled={busy} onClick={() => void load()}>
        Reload capture review
      </Button>
      {message && <p role="status">{message}</p>}
      <DetailSection id="capture-connections" title="Connections">
        {!data?.connections.length && <p>No configured connections available.</p>}
        {data?.connections.map((c) => (
          <article key={c.id} className="mb-4 space-y-2 rounded-control border border-border p-4">
            <h3 className="font-semibold">
              {c.provider} · {c.source_code}
            </h3>
            <p className="break-all text-sm">
              Connection {c.id} · {c.active ? 'Enabled locally' : 'Disabled'} · Version {c.version}
            </p>
            <p className="break-all text-xs">
              Accountable sponsor {c.sponsor_id}. Owner {c.owner_id ?? 'Unassigned'}.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditing(c);
                  setOwner(c.owner_id ?? '');
                  setExpires(new Date(c.expires_at).toISOString());
                }}
              >
                Edit delegation
              </Button>
              <Button disabled={busy || !c.active} onClick={() => void perform('process', c.id)}>
                Process local batch
              </Button>
            </div>
          </article>
        ))}
        {editing && (
          <form
            aria-label="Edit capture delegation"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void perform('save', {
                id: editing.id,
                principalId: editing.principal_id,
                provider: editing.provider,
                source: editing.source_code,
                binding: editing.binding,
                owner: owner || null,
                page: editing.page_id,
                form: editing.form_id,
                active: editing.active,
                expires,
                version: editing.version,
              });
            }}
          >
            <FormField
              id="capture-owner"
              label="Fixed Sales owner UUID"
              description="Leave blank for explicit unassigned intake."
              disabled={busy}
            >
              {(control) => (
                <Input {...control} value={owner} onChange={(e) => setOwner(e.target.value)} />
              )}
            </FormField>
            <FormField id="capture-expiry" label="Delegation expiry (ISO UTC)" disabled={busy}>
              {(control) => (
                <Input {...control} value={expires} onChange={(e) => setExpires(e.target.value)} />
              )}
            </FormField>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                disabled={busy}
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              Enable this local connection
            </label>
            <div className="flex gap-3">
              <Button type="submit" disabled={busy}>
                Save delegation
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setEditing(null)}>
                Cancel delegation edit
              </Button>
            </div>
          </form>
        )}
      </DetailSection>
      <DetailSection id="capture-inbox" title="Intake receipts">
        <p className="mb-3 text-sm">
          Page {page + 1} · {data?.total ?? 0} receipts. Customer payloads and secrets are excluded
          from this review.
        </p>
        {data?.rows.map((row) => (
          <article key={row.id} className="mb-3 space-y-2 rounded-control border border-border p-3">
            <p className="break-all text-sm">
              {row.id} · {row.state} · Attempts {row.attempts}
            </p>
            <p className="text-xs">{row.safe_error ?? 'No recorded error'}</p>
            {row.resulting_lead_id && (
              <a className="text-sm underline" href={`/leads/details/${row.resulting_lead_id}`}>
                Open captured lead
              </a>
            )}
            {row.state === 'held' && (
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => void perform('retry', { id: row.id, version: row.version })}
              >
                Retry held event
              </Button>
            )}
          </article>
        ))}
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={busy || page === 0}
            onClick={() => void load(page - 1)}
          >
            Previous receipt page
          </Button>
          <Button
            variant="outline"
            disabled={busy || !data || (page + 1) * 20 >= data.total}
            onClick={() => void load(page + 1)}
          >
            Next receipt page
          </Button>
        </div>
      </DetailSection>
    </div>
  );
}