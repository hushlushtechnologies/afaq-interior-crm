'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useAccess } from '@/components/access/access-provider';
import { DetailSection } from '@/components/layout/detail-section';
import { PageHeader } from '@/components/layout/page-header';
import { LeadPriorityBadge, LeadStageBadge } from '@/components/leads/lead-badges';
import { LeadDetailEditor, detailTitles } from '@/components/leads/lead-detail-editor';
import { LeadDetailArchive } from '@/components/leads/lead-detail-archive';
import { LeadSiteVisits } from '@/components/leads/lead-site-visits';
import { Button, buttonClassName } from '@/components/ui/button';
import { hasRequiredScope } from '@/features/access/permissions';
import { loadLeadDetails } from '@/features/lead-details/actions';
import { loadArchivedLeadDetails } from '@/features/lead-details/archive-actions';
import type { DetailPage, DetailRecord } from '@/features/lead-details/contracts';
import type { LeadRow, Result } from '@/features/leads/schemas';

export type InitialDetails = Record<DetailRecord['kind'], Result<DetailPage>>;
const timestamp = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dubai',
  }).format(new Date(value));

const fieldLabel = (key: string) =>
  (
    ({
      body: 'Note',
      sort_order: 'Display order',
      completion_state: 'Requirement status',
    }) as Record<string, string>
  )[key] ?? key.replaceAll('_', ' ');
const fieldValue = (key: string, value: unknown) =>
  value === null || value === undefined
    ? 'Not recorded'
    : key === 'completion_state'
      ? String(value).replaceAll('_', ' ')
      : String(value);

function DetailPanel({
  lead,
  kind,
  initial,
  writable,
  locked,
  acquire,
  release,
}: {
  lead: LeadRow;
  kind: DetailRecord['kind'];
  initial: Result<DetailPage>;
  writable: boolean;
  locked: boolean;
  acquire: () => boolean;
  release: () => void;
}) {
  const { snapshot } = useAccess();
  const [result, setResult] = useState(initial);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<{ record: DetailRecord | null } | null>(null);
  const [message, setMessage] = useState('');
  const [archived, setArchived] = useState(false);
  const canArchive =
    writable &&
    (hasRequiredScope(snapshot, 'leads.archive', 'company') ||
      (lead.assigned_user_id === snapshot.userId &&
        hasRequiredScope(snapshot, 'leads.archive', 'assigned')) ||
      (lead.created_by === snapshot.userId && hasRequiredScope(snapshot, 'leads.archive', 'own')));
  async function reload(next = page, nextArchived = archived) {
    if (!acquire()) return;
    setLoading(true);
    try {
      const load = nextArchived ? loadArchivedLeadDetails : loadLeadDetails;
      setResult(await load({ leadId: lead.id, kind, page: next }));
      setPage(next);
      setArchived(nextArchived);
    } catch {
      setResult({
        status: 'error',
        message: 'Details could not be loaded. Retry loading.',
        retryable: true,
      });
    } finally {
      setLoading(false);
      release();
    }
  }
  function edit(record: DetailRecord | null) {
    if (acquire()) setEditor({ record });
  }
  function close(saved: boolean) {
    setEditor(null);
    release();
    if (saved) {
      setMessage('Details saved. History retained.');
      void reload(0);
    }
  }
  const rows = result.status === 'ok' ? result.data.rows : [];
  const canAdd =
    writable &&
    !archived &&
    result.status === 'ok' &&
    (kind !== 'requirements' || result.data.total === 0);
  return (
    <DetailSection
      id={`real-${kind}`}
      title={detailTitles[kind]}
      description={
        kind === 'requirements'
          ? 'Partial collection is allowed. Completion records employee assessment.'
          : kind === 'room'
            ? 'Multiple rooms may share a name. Measurements remain unverified notes.'
            : 'Internal employee notes; no customer message is sent.'
      }
      actions={
        <div className="flex flex-wrap gap-2">
          {kind !== 'requirements' && (
            <Button variant="outline" disabled={locked} onClick={() => void reload(0, !archived)}>
              Show {archived ? 'active' : 'archived'} {kind === 'room' ? 'rooms' : 'notes'}
            </Button>
          )}
          {canAdd && (
            <Button disabled={locked} onClick={() => edit(null)}>
              Add {kind === 'requirements' ? 'requirements' : kind}
            </Button>
          )}
          <Button variant="outline" disabled={locked} onClick={() => void reload()}>
            Reload {kind}
          </Button>
        </div>
      }
    >
      {loading && <p role="status">Loading {kind}…</p>}
      {message && (
        <p role="status" className="mb-3 text-sm">
          {message}
        </p>
      )}
      {result.status === 'error' ? (
        <p role="alert">{result.message}</p>
      ) : (
        <>
          <p role="status" className="mb-4 text-sm text-muted-foreground">
            {archived ? 'Archived ' : ''}
            {detailTitles[kind]} page {page + 1}: {rows.length} of {result.data.total}
          </p>
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No {kind === 'room' ? 'rooms' : kind === 'note' ? 'notes' : 'requirements'} recorded
              on this page.
            </p>
          )}
          <div className={kind === 'room' ? 'grid gap-4 sm:grid-cols-2' : 'space-y-4'}>
            {rows.map((record) => (
              <article
                key={record.id}
                className="min-w-0 space-y-3 rounded-control border border-border bg-background p-4"
              >
                <h3 className="font-semibold">
                  {record.kind === 'room'
                    ? record.data.name
                    : record.kind === 'note'
                      ? 'Internal note'
                      : 'Collected requirements'}
                </h3>
                <dl className="space-y-2 text-sm">
                  {Object.entries(record.data)
                    .filter(([key]) => key !== 'name')
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-muted-foreground">{fieldLabel(key)}</dt>
                        <dd className="whitespace-pre-wrap break-words">
                          {fieldValue(key, value)}
                        </dd>
                      </div>
                    ))}
                </dl>
                <p className="break-all text-xs text-muted-foreground">
                  Author: {record.created_by === snapshot.userId ? 'You' : record.created_by} ·{' '}
                  {timestamp(record.created_at)} (Dubai)
                </p>
                <p className="text-xs text-muted-foreground">
                  Version {record.version} · Updated {timestamp(record.updated_at)} (Dubai)
                </p>
                {record.archived_at && (
                  <p className="text-xs text-muted-foreground">
                    Archived {timestamp(record.archived_at)} (Dubai). Content retained.
                  </p>
                )}
                {!archived &&
                  !record.archived_at &&
                  writable &&
                  (kind !== 'note' ||
                    record.created_by === snapshot.userId ||
                    hasRequiredScope(snapshot, 'leads.update', 'company')) && (
                    <Button variant="outline" disabled={locked} onClick={() => edit(record)}>
                      Edit {kind}
                    </Button>
                  )}
                {!archived && !record.archived_at && kind !== 'requirements' && canArchive && (
                  <LeadDetailArchive
                    record={record}
                    disabled={locked}
                    acquire={acquire}
                    release={release}
                    onArchived={() => {
                      setMessage('Details archived. History retained.');
                      void reload(0);
                    }}
                  />
                )}
              </article>
            ))}
          </div>
          {kind !== 'requirements' && (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={locked || page === 0}
                onClick={() => void reload(page - 1)}
              >
                Previous {kind} page
              </Button>
              <Button
                variant="outline"
                disabled={locked || (page + 1) * 20 >= result.data.total}
                onClick={() => void reload(page + 1)}
              >
                Next {kind} page
              </Button>
            </div>
          )}
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer font-medium">
              {detailTitles[kind]} history — latest 50 events
            </summary>
            <p className="my-2 text-muted-foreground">
              Older events remain stored. Times use Asia/Dubai.
            </p>
            {result.data.events.length === 0 && <p>No history recorded.</p>}
            <ol className="space-y-3">
              {result.data.events.map((event) => (
                <li key={event.id} className="border-l-2 border-border pl-3">
                  <p className="break-all">
                    {event.action} · {timestamp(event.occurred_at)} ·{' '}
                    {event.actor_id === snapshot.userId ? 'You' : event.actor_id}
                  </p>
                  <details>
                    <summary className="cursor-pointer">Recorded changes</summary>
                    {event.action === 'archived' && (
                      <p>Record archived; content and authorship retained.</p>
                    )}
                    <dl className="space-y-2 text-xs">
                      {Object.entries(event.after_data.data)
                        .filter(
                          ([key, value]) =>
                            value !==
                            (event.before_data?.data as Record<string, unknown> | undefined)?.[key],
                        )
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>{fieldLabel(key)}</dt>
                            <dd className="whitespace-pre-wrap break-words">
                              Before:{' '}
                              {fieldValue(
                                key,
                                (event.before_data?.data as Record<string, unknown> | undefined)?.[
                                  key
                                ],
                              )}
                            </dd>
                            <dd className="whitespace-pre-wrap break-words">
                              After: {fieldValue(key, value)}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </details>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
      {editor && (
        <LeadDetailEditor
          leadId={lead.id}
          kind={kind}
          record={editor.record}
          onClose={() => close(false)}
          onSaved={() => close(true)}
        />
      )}
    </DetailSection>
  );
}

export function LeadDetailsWorkspace({
  lead,
  initial,
}: {
  lead: LeadRow;
  initial: InitialDetails;
}) {
  const { snapshot } = useAccess();
  const [locked, setLocked] = useState(false);
  const gate = useRef(false);
  const writable =
    !lead.archived_at &&
    lead.stage !== 'lost' &&
    (hasRequiredScope(snapshot, 'leads.update', 'company') ||
      (lead.assigned_user_id === snapshot.userId &&
        hasRequiredScope(snapshot, 'leads.update', 'assigned')) ||
      (lead.created_by === snapshot.userId && hasRequiredScope(snapshot, 'leads.update', 'own')));
  function acquire() {
    if (gate.current) return false;
    gate.current = true;
    setLocked(true);
    return true;
  }
  function release() {
    gate.current = false;
    setLocked(false);
  }
  const overview = {
    'Project location': lead.location,
    'Property type': lead.property_type,
    'Intake budget (AED)': lead.budget,
    'Inquiry date': lead.inquiry_on,
    'Next follow-up date': lead.follow_up_on,
    Email: lead.email,
    'Primary phone': lead.phone,
    'Alternate phone': lead.alternate_phone,
    Source: lead.source_code,
    'Assigned employee':
      lead.assigned_name ?? (lead.assigned_user_id ? 'Assigned employee' : 'Unassigned'),
  };
  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <PageHeader
        title={lead.customer_name}
        eyebrow={`Lead #${lead.reference}`}
        description="Customer inquiry and internal requirements."
      />
      <nav aria-label="Lead navigation" className="flex flex-wrap gap-3">
        <Link
          href="/leads"
          aria-disabled={locked}
          onClick={(event) => {
            if (gate.current) event.preventDefault();
          }}
          className={buttonClassName({ variant: 'outline' })}
        >
          All leads
        </Link>
        <Button variant="outline" disabled={locked} onClick={() => window.location.reload()}>
          Reload lead details
        </Button>
      </nav>
      {!writable && (
        <p className="rounded-control bg-muted p-4 text-sm">
          Read-only lead details. Lost, archived or restricted records cannot be changed.
        </p>
      )}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <DetailSection
            id="real-overview"
            title="Lead overview"
            actions={<LeadPriorityBadge priority={lead.priority} />}
          >
            <LeadStageBadge stage={lead.stage} />
            <p className="mt-4 whitespace-pre-wrap break-words text-sm">
              {lead.description ?? 'No inquiry description recorded.'}
            </p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {Object.entries(overview).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-words text-sm">
                    {value === null ? 'Not recorded' : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </DetailSection>
          {(['requirements', 'room', 'note'] as const).map((kind) => (
            <DetailPanel
              key={kind}
              lead={lead}
              kind={kind}
              initial={initial[kind]}
              writable={writable}
              locked={locked}
              acquire={acquire}
              release={release}
            />
          ))}
          <LeadSiteVisits leadId={lead.id} locked={locked} acquire={acquire} release={release} />
        </div>
        <aside aria-label="Lead context" className="min-w-0 space-y-6">
          <DetailSection id="real-intake" title="Original inquiry evidence">
            <p className="whitespace-pre-wrap break-words text-sm">
              {lead.initial_note ?? 'No initial note recorded.'}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Created {timestamp(lead.created_at)} (Dubai). Source and creator are preserved.
            </p>
          </DetailSection>
          <DetailSection id="real-workflow" title="Sales workflow">
            <p className="text-sm">
              Use View in the lead list for intake edits, assignment and protected stage changes.
              Requirement completion does not approve a quotation or create a project.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              The follow-up date records intent; reminders are separate. Private attachments are not
              connected in this part.
            </p>
          </DetailSection>
        </aside>
      </div>
    </div>
  );
}