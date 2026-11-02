import type { ComponentProps } from 'react';

import { Badge } from '@/components/ui/badge';
import { getDemoStageLabel } from '@/lib/demo/stages';
import type { DemoPriority, DemoStage } from '@/types/demo-crm';

type BadgeTone = NonNullable<ComponentProps<typeof Badge>['tone']>;

const stageTones: Record<DemoStage, BadgeTone> = {
  new: 'neutral',
  assigned: 'info',
  contacted: 'info',
  requirements: 'warning',
  'site-visit': 'warning',
  'quotation-shared': 'info',
  negotiation: 'warning',
  won: 'success',
  lost: 'destructive',
};

const priorityTones: Record<DemoPriority, BadgeTone> = {
  low: 'outline',
  normal: 'neutral',
  high: 'warning',
  urgent: 'destructive',
};

export function LeadStageBadge({ stage }: { stage: DemoStage }) {
  return <Badge tone={stageTones[stage]}>{getDemoStageLabel(stage)}</Badge>;
}

export function LeadPriorityBadge({ priority }: { priority: DemoPriority }) {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);

  return <Badge tone={priorityTones[priority]}>{label}</Badge>;
}
