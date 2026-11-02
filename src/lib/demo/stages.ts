import type { DemoStage } from '@/types/demo-crm';

export const DEMO_STAGES: readonly {
  id: DemoStage;
  label: string;
  protected: boolean;
}[] = [
  { id: 'new', label: 'New', protected: false },
  { id: 'assigned', label: 'Assigned', protected: false },
  { id: 'contacted', label: 'Contacted', protected: false },
  { id: 'requirements', label: 'Requirements', protected: false },
  { id: 'site-visit', label: 'Site visit', protected: false },
  {
    id: 'quotation-shared',
    label: 'Quotation shared',
    protected: false,
  },
  { id: 'negotiation', label: 'Negotiation', protected: false },
  { id: 'won', label: 'Won', protected: true },
  { id: 'lost', label: 'Lost', protected: true },
];

export function isProtectedDemoStage(stage: DemoStage): boolean {
  return stage === 'won' || stage === 'lost';
}

export function getDemoStageLabel(stage: DemoStage): string {
  return DEMO_STAGES.find((item) => item.id === stage)?.label ?? stage;
}
