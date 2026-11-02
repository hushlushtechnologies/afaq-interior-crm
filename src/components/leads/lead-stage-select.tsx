'use client';

import type { Ref } from 'react';

import { useDemoCrm } from '@/components/demo/demo-crm-provider';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { DEMO_STAGES, isProtectedDemoStage } from '@/lib/demo/stages';
import type { DemoLead, DemoStage } from '@/types/demo-crm';

export function LeadStageSelect({
  lead,
  id,
  controlRef,
}: {
  lead: DemoLead;
  id?: string;
  controlRef?: Ref<HTMLSelectElement>;
}) {
  const { moveLead } = useDemoCrm();
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
        disabled={protectedOutcome}
        aria-describedby={helpId}
        onChange={(event) => {
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
          <option key={stage.id} value={stage.id} disabled={stage.protected}>
            {stage.label}
          </option>
        ))}
      </NativeSelect>

      <p id={helpId} className="sr-only">
        Changes affect local demo state only. Won and Lost transitions and reopening are
        unavailable.
      </p>
    </div>
  );
}
