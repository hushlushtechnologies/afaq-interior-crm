'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CalendarDays, Mail, MessageCircle, Phone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DemoBanner } from '@/components/demo/demo-banner';
import { useDemoCrm } from '@/components/demo/demo-crm-provider';
import { DemoStatePanel } from '@/components/demo/demo-state-panel';
import { DetailSection } from '@/components/layout/detail-section';
import { PageHeader } from '@/components/layout/page-header';
import { LeadPriorityBadge, LeadStageBadge } from '@/components/leads/lead-badges';
import { LeadStageSelect } from '@/components/leads/lead-stage-select';
import { RoomReferencePreview } from '@/components/leads/room-reference-preview';
import { WorkspaceDetails } from '@/components/shell/workspace-details';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClassName } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { formatDemoDate, formatDemoMoney } from '@/lib/demo/format';
import { focusRing } from '@/lib/utils';
import type { DemoLead, DemoQuotation } from '@/types/demo-crm';

const QUOTATION_STATUS_LABELS: Record<DemoQuotation['status'], string> = {
  draft: 'Draft',
  'pm-review': 'PM review',
  approved: 'PM approved',
  sent: 'Sent',
  accepted: 'Client accepted',
};

function DemoNoteForm({ lead }: { lead: DemoLead }) {
  const { addNote } = useDemoCrm();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const textareaId = `new-demo-note-${lead.id}`;
  const helpId = `${textareaId}-help`;
  const errorId = `${textareaId}-error`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedBody = body.trim();

    if (!trimmedBody) {
      setError('Enter a note before adding it.');
      return;
    }

    if (trimmedBody.length > 1000) {
      setError('Keep the note within 1,000 characters.');
      return;
    }

    addNote(lead.id, trimmedBody);
    setBody('');
    setError(null);
  }

  return (
    <form
      aria-label="Add a demo note"
      onSubmit={handleSubmit}
      className="mt-6 space-y-3 border-t border-border pt-5"
    >
      <Label htmlFor={textareaId} required>
        New note
      </Label>

      <Textarea
        id={textareaId}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);

          if (error) {
            setError(null);
          }
        }}
        required
        maxLength={1000}
        rows={4}
        placeholder="Write a sample internal note..."
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${helpId} ${errorId}` : helpId}
      />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <p id={helpId} className="max-w-lg text-xs leading-5 text-muted-foreground">
          This note stays in the current tab. Do not enter real client information.
        </p>

        <p className="text-xs text-muted-foreground">
          {body.length.toLocaleString('en-GB')} / 1,000
        </p>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit">Add demo note</Button>
    </form>
  );
}

export function LeadDetailsPrototype({ leadId }: { leadId: string }) {
  const { data, previewState, setPreviewState, assignOwner, toggleRequirement, announce } =
    useDemoCrm();

  const lead = data.leads.find((item) => item.id === leadId);

  if (previewState !== 'ready') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Lead details"
          description="A development preview using fictional information."
          actions={<WorkspaceDetails moduleId="leads" />}
        />

        <DemoBanner />

        <DemoStatePanel state={previewState} onRetry={() => setPreviewState('ready')} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Lead unavailable"
          description="This sample lead is not available in the current preview."
        />

        <Link href="/leads?preview=1" className={buttonClassName({ variant: 'outline' })}>
          Return to all leads
        </Link>
      </div>
    );
  }

  const owner = data.owners.find((item) => item.id === lead.ownerId);
  const quotations = data.quotations.filter((quotation) => quotation.leadId === lead.id);

  const completedRequirements = lead.requirements.filter(
    (requirement) => requirement.completed,
  ).length;

  const isOverdue = lead.nextFollowUpOn !== null && lead.nextFollowUpOn < data.asOfDate;

  const activities = [...lead.activities].sort((first, second) =>
    second.at.localeCompare(first.at),
  );

  const notes = [...lead.notes].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.clientName}
        description={lead.title}
        actions={<WorkspaceDetails moduleId="leads" />}
      />

      <DemoBanner />

      <nav aria-label="Lead navigation" className="flex flex-wrap items-center gap-3">
        <Link
          href="/leads?preview=1"
          className={buttonClassName({
            variant: 'outline',
            size: 'sm',
          })}
        >
          <Icon icon={ArrowLeft} size="sm" />
          All leads
        </Link>

        <Link
          href="/leads/pipeline?preview=1"
          className={buttonClassName({
            variant: 'ghost',
            size: 'sm',
          })}
        >
          Sales pipeline
          <Icon icon={ArrowUpRight} size="sm" />
        </Link>
      </nav>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <DetailSection
            id="lead-overview"
            title="Lead overview"
            description="Fictional inquiry information for this interface preview."
            actions={<LeadPriorityBadge priority={lead.priority} />}
          >
            <div className="flex flex-wrap items-center gap-2">
              <LeadStageBadge stage={lead.stage} />
              <Badge tone="outline">{lead.source}</Badge>
              <Badge tone="outline">{lead.propertyType}</Badge>
            </div>

            <p className="mt-4 text-sm leading-7 text-foreground">{lead.summary}</p>

            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">Sample location</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{lead.location}</dd>
              </div>

              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">Inquiry date</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {formatDemoDate(lead.createdOn)}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">Indicative budget</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">
                  {formatDemoMoney(lead.budget)}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">Preview record</dt>
                <dd className="mt-1 break-words text-sm font-medium text-foreground">{lead.id}</dd>
              </div>
            </dl>

            <p className="mt-5 rounded-control bg-muted p-3 text-xs leading-6 text-muted-foreground">
              The indicative budget is a sample inquiry value. It is not booked revenue, an invoice,
              or a project cost.
            </p>
          </DetailSection>

          <DetailSection
            id="lead-contact"
            title="Contact information"
            description="Contact buttons show preview messages only."
          >
            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">Sample email</dt>
                <dd className="mt-1 break-all text-sm text-foreground">{lead.email}</dd>
              </div>

              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">Placeholder phone</dt>
                <dd className="mt-1 text-sm text-foreground">{lead.phoneDisplay}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => announce('WhatsApp is a preview action. No message was sent.')}
              >
                <Icon icon={MessageCircle} size="sm" />
                Preview WhatsApp
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => announce('Email is a preview action. No email was sent.')}
              >
                <Icon icon={Mail} size="sm" />
                Preview email
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => announce('Calling is a preview action. No call was started.')}
              >
                <Icon icon={Phone} size="sm" />
                Preview call
              </Button>
            </div>
          </DetailSection>

          <DetailSection
            id="lead-requirements"
            title="Requirements checklist"
            description="Checkbox changes are shared with this tab's demo state."
            actions={
              <Badge tone="neutral">
                {completedRequirements} / {lead.requirements.length} complete
              </Badge>
            }
          >
            <ul className="space-y-2">
              {lead.requirements.map((requirement) => (
                <li key={requirement.id}>
                  <label
                    htmlFor={requirement.id}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-border bg-background px-3 py-3 text-sm text-foreground"
                  >
                    <input
                      id={requirement.id}
                      type="checkbox"
                      checked={requirement.completed}
                      onChange={() => toggleRequirement(lead.id, requirement.id)}
                      className={`size-5 shrink-0 accent-primary ${focusRing}`}
                    />

                    <span className="min-w-0 break-words">{requirement.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </DetailSection>

          <DetailSection
            id="lead-rooms"
            title="Rooms and scope"
            description="Room areas and final measurements are still pending."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {lead.rooms.map((room) => (
                <article
                  key={room.id}
                  className="min-w-0 rounded-control border border-border bg-background p-4"
                >
                  <h3 className="font-semibold text-foreground">{room.name}</h3>

                  <p className="mt-1 text-xs text-muted-foreground">{room.areaLabel}</p>

                  <p className="mt-3 text-sm leading-6 text-foreground">{room.requirements}</p>
                </article>
              ))}
            </div>
          </DetailSection>

          <DetailSection
            id="lead-references"
            title="Reference direction"
            description="Beige illustrations demonstrate the layout for future room references."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {lead.rooms.slice(0, 2).map((room) => (
                <RoomReferencePreview key={room.id} roomName={room.name} />
              ))}
            </div>
          </DetailSection>

          <DetailSection
            id="lead-notes"
            title="Internal notes"
            description="Sample notes and notes added during this preview."
          >
            <div className="space-y-3">
              {notes.length ? (
                notes.map((note) => {
                  const author = data.owners.find((item) => item.id === note.authorId);

                  return (
                    <article
                      key={note.id}
                      className="min-w-0 rounded-control border border-border bg-background p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {author?.name ?? 'Sample employee'}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {formatDemoDate(note.createdAt)}
                        </p>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                        {note.body}
                      </p>
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No sample notes have been added.</p>
              )}
            </div>

            <DemoNoteForm lead={lead} />
          </DetailSection>

          <DetailSection
            id="lead-activity"
            title="Activity timeline"
            description="Includes fictional fixture activity and changes recorded by this preview."
          >
            <ol className="space-y-4">
              {activities.map((activity) => (
                <li key={activity.id} className="min-w-0 border-l-2 border-border pl-4">
                  <p className="break-words text-sm leading-6 text-foreground">
                    {activity.summary}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDemoDate(activity.at)}
                  </p>
                </li>
              ))}
            </ol>
          </DetailSection>

          <DetailSection
            id="lead-attachments"
            title="Attachments"
            description="Sample file metadata only. No files have been uploaded."
          >
            <ul className="space-y-3">
              {lead.attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-background p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-foreground">
                      {attachment.name}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {attachment.kind} · {attachment.sizeLabel}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`File information for ${attachment.name}`}
                    onClick={() =>
                      announce(
                        `${attachment.name} is sample metadata. No stored file is available to open or download.`,
                      )
                    }
                  >
                    File information
                  </Button>
                </li>
              ))}
            </ul>
          </DetailSection>

          <DetailSection
            id="lead-quotations"
            title="Related quotations"
            description="Sample quotation summaries; approval and acceptance actions are not connected."
          >
            {quotations.length ? (
              <ul className="space-y-3">
                {quotations.map((quotation) => (
                  <li
                    key={quotation.id}
                    className="min-w-0 rounded-control border border-border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold text-foreground">
                          {quotation.title}
                        </h3>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {quotation.version} · {formatDemoDate(quotation.createdOn)}
                        </p>
                      </div>

                      <Badge tone="outline">{QUOTATION_STATUS_LABELS[quotation.status]}</Badge>
                    </div>

                    <p className="mt-4 text-lg font-semibold text-foreground">
                      {formatDemoMoney(quotation.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-control bg-muted p-4 text-sm leading-6 text-muted-foreground">
                No sample quotation is linked to this lead.
              </p>
            )}

            <Link
              href="/quotations"
              className={buttonClassName({
                variant: 'outline',
                size: 'sm',
                className: 'mt-4',
              })}
            >
              Open quotations workspace
              <Icon icon={ArrowUpRight} size="sm" />
            </Link>
          </DetailSection>
        </div>

        <aside aria-label="Lead context" className="min-w-0 space-y-6">
          <DetailSection
            id="lead-stage"
            title="Opportunity stage"
            description="Changes update the table and Kanban in this tab."
          >
            <LeadStageSelect lead={lead} id={`details-stage-${lead.id}`} />

            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              Won, Lost, and reopening closed leads remain unavailable. Project conversion will
              require the approved business workflow.
            </p>
          </DetailSection>

          <DetailSection
            id="lead-assignment"
            title="Assignment"
            description="Choose a fictional owner for this preview."
          >
            <div className="mb-4 flex min-w-0 items-center gap-3">
              <Avatar name={owner?.name ?? 'Sample owner'} />

              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-foreground">
                  {owner?.name ?? 'Sample owner'}
                </p>

                <p className="text-xs text-muted-foreground">
                  {owner?.label ?? 'Sample sales owner'}
                </p>
              </div>
            </div>

            <Label htmlFor="details-owner">Assigned sample owner</Label>

            <NativeSelect
              id="details-owner"
              value={lead.ownerId}
              onChange={(event) => assignOwner(lead.id, event.target.value)}
              className="mt-2"
            >
              {data.owners.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </DetailSection>

          <DetailSection
            id="lead-follow-up"
            title="Next follow-up"
            description={`Compared with the sample snapshot of ${formatDemoDate(data.asOfDate)}.`}
          >
            {lead.nextFollowUpOn ? (
              <>
                <div className="flex items-start gap-3">
                  <Icon icon={CalendarDays} />

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {formatDemoDate(lead.nextFollowUpOn)}
                    </p>

                    <div className="mt-2">
                      <Badge tone={isOverdue ? 'warning' : 'info'}>
                        {isOverdue ? 'Overdue in sample snapshot' : 'Scheduled in sample snapshot'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  onClick={() =>
                    announce(
                      'Follow-up scheduling is a preview. No reminder or background job was created.',
                    )
                  }
                >
                  Preview follow-up
                </Button>
              </>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                No next follow-up is set for this sample lead.
              </p>
            )}
          </DetailSection>
        </aside>
      </div>
    </div>
  );
}
