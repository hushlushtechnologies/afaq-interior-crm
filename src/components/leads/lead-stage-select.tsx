'use client';

import type { Ref } from 'react';
import Link from 'next/link';

import { useLeadView, type LeadListItem } from '@/components/leads/lead-view-context';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { DEMO_STAGES, isProtectedDemoStage } from '@/lib/demo/stages';
import type { DemoStage } from '@/types/demo-crm';
import { buttonClassName } from '@/components/ui/button';

export function LeadStageSelect({
  lead,
  id,
  controlRef,
}: {
  lead: LeadListItem;
  id?: string;
  controlRef?: Ref<HTMLSelectElement>;
}) {
  const { moveLead, readOnly, pipeline, serverTable } = useLeadView();
  const controlId = id ?? 'lead-stage-' + lead.id;
  const helpId = controlId + '-help';
  const protectedOutcome = isProtectedDemoStage(lead.stage);

  return (
    <div className="min-w-0">
      <Label htmlFor={controlId} className="sr-only">
        Move {lead.clientName} to stage
      </Label>

      <NativeSelect
        ref={controlRef}
        id={controlId}
        value={lead.stage}
        disabled={protectedOutcome || (pipeline ? !pipeline.canMove(lead.id) : readOnly)}
        aria-describedby={helpId}
        onChange={(event) => {
          if (pipeline) {
            pipeline.requestMove(lead.id, event.target.value as DemoStage);
            return;
          }
          const restoreFocus = document.activeElement === event.currentTarget;

          const moved = moveLead(lead.id, event.target.value as DemoStage);

          if (moved && restoreFocus) {
            requestAnimationFrame(() => {
              const destination =
                document.getElementById(controlId) ??
                document.getElementById('lead-results-status');

              destination?.focus();
            });
          }
        }}
      >
        {DEMO_STAGES.map((stage) => (
          <option
            key={stage.id}
            value={stage.id}
            disabled={
              pipeline
                ? !['new', 'assigned', 'contacted', 'requirements', 'site-visit'].includes(stage.id)
                : stage.protected
            }
          >
            {stage.label}
          </option>
        ))}
      </NativeSelect>

      <p id={helpId} className="sr-only">
        {pipeline
          ? 'Select a working stage to review and confirm the database change. Lost and reopening are in Lead information.'
          : readOnly
            ? 'Stage transitions are currently unavailable.'
            : 'Changes affect local demo state only. Won and Lost transitions and reopening are unavailable.'}
      </p>
      {pipeline && (
        <Link
          href={`/leads/details/${lead.id}`}
          prefetch={false}
          aria-label={`Full details for ${lead.clientName}`}
          aria-disabled={serverTable?.disabled}
          tabIndex={serverTable?.disabled ? -1 : undefined}
          onClick={(event) => {
            if (serverTable?.disabled) event.preventDefault();
          }}
          className={buttonClassName({ variant: 'ghost', size: 'sm', className: 'mt-1' })}
        >
          Full details
        </Link>
      )}
    </div>
  );
}