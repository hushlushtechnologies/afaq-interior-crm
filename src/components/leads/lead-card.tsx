'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useDraggable } from '@dnd-kit/core';
import { CalendarDays, GripVertical } from 'lucide-react';

import { useLeadView, type LeadListItem } from '@/components/leads/lead-view-context';
import { LeadPriorityBadge } from '@/components/leads/lead-badges';
import { LeadStageSelect } from '@/components/leads/lead-stage-select';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { formatDemoDate, formatDemoMoney } from '@/lib/demo/format';
import { leadDetailsHref } from '@/lib/demo/lead-views';
import { isProtectedDemoStage } from '@/lib/demo/stages';
import { cn, focusRing } from '@/lib/utils';

export function DraggableLeadCard({ lead }: { lead: LeadListItem }) {
  const { data, readOnly, onOpen, pipeline } = useLeadView();
  const stageRef = useRef<HTMLSelectElement>(null);
  const protectedOutcome = isProtectedDemoStage(lead.stage);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: protectedOutcome || (pipeline ? !pipeline.canMove(lead.id) : readOnly),
  });

  const owner = data.owners.find((candidate) => candidate.id === lead.ownerId);
  const overdue = lead.nextFollowUpOn !== null && lead.nextFollowUpOn < data.asOfDate;

  return (
    <div
      ref={setNodeRef}
      data-testid={'lead-card-' + lead.id}
      className={cn('min-w-0', isDragging && 'opacity-40')}
    >
      <Card>
        <CardHeader className="space-y-3 p-4 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-2">
              <LeadPriorityBadge priority={lead.priority} />

              <h4 className="text-sm leading-snug font-semibold">
                {onOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpen(lead.id)}
                    className={cn('rounded text-left', focusRing)}
                  >
                    {lead.clientName}
                  </button>
                ) : (
                  <Link href={leadDetailsHref(lead.id)} className={cn('rounded', focusRing)}>
                    {lead.clientName}
                  </Link>
                )}
              </h4>
            </div>

            <IconButton
              {...attributes}
              {...listeners}
              ref={setActivatorNodeRef}
              label={
                (pipeline
                  ? 'Move lead card for '
                  : readOnly
                    ? 'Stage changes unavailable for '
                    : 'Move demo card for ') + lead.clientName
              }
              icon={GripVertical}
              variant="ghost"
              disabled={protectedOutcome || (pipeline ? !pipeline.canMove(lead.id) : readOnly)}
              onClick={() => stageRef.current?.focus()}
              className="-mt-1 -mr-1 shrink-0 touch-none cursor-grab active:cursor-grabbing"
            />
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">{lead.title}</p>

          <p className="text-lg font-semibold tracking-tight tabular-nums">
            {formatDemoMoney(lead.budget)}
          </p>
        </CardHeader>

        <CardContent className="space-y-4 px-4 pb-4 sm:px-4 sm:pb-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="outline">{lead.source}</Badge>
            <Badge>{lead.propertyType}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <span aria-hidden="true">
              <Avatar name={owner?.name ?? 'Sample owner'} size="sm" />
            </span>
            <p className="text-xs text-muted-foreground">{owner?.name ?? 'Unassigned'}</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Icon icon={CalendarDays} size="sm" />

            <span className={overdue ? 'text-warning' : 'text-muted-foreground'}>
              {lead.nextFollowUpOn
                ? 'Follow-up ' + formatDemoDate(lead.nextFollowUpOn, false)
                : 'No follow-up date'}
            </span>
          </div>

          <LeadStageSelect lead={lead} controlRef={stageRef} />
        </CardContent>
      </Card>
    </div>
  );
}

export function LeadDragPreview({ lead }: { lead: LeadListItem }) {
  return (
    <div aria-hidden="true" className="w-72">
      <Card className="border-ring shadow-float">
        <CardHeader className="space-y-3 p-4 sm:p-4">
          <LeadPriorityBadge priority={lead.priority} />
          <p className="text-sm font-semibold">{lead.clientName}</p>
          <p className="text-sm text-muted-foreground">{lead.title}</p>
          <p className="font-semibold tabular-nums">{formatDemoMoney(lead.budget)}</p>
        </CardHeader>
      </Card>
    </div>
  );
}
