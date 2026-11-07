'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useOptionalDemoCrm } from '@/components/demo/demo-crm-provider';
import type { DemoLead, DemoOwner, DemoStage } from '@/types/demo-crm';

export type LeadListItem = Omit<
  Pick<
    DemoLead,
    | 'id'
    | 'clientName'
    | 'title'
    | 'priority'
    | 'stage'
    | 'ownerId'
    | 'createdOn'
    | 'nextFollowUpOn'
  >,
  never
> & {
  budget: number | null;
  source: string;
  propertyType: string | null;
};

type LeadView = {
  data: { owners: readonly DemoOwner[]; asOfDate: string };
  readOnly: boolean;
  onOpen?: (id: string) => void;
  pipeline?: {
    canMove: (id: string) => boolean;
    requestMove: (id: string, stage: DemoStage) => void;
  };
  stageCounts?: Partial<Record<DemoStage, number>>;
  serverTable?: {
    sort: string;
    direction: 'asc' | 'desc';
    disabled: boolean;
    onSort: (sort: string, direction: 'asc' | 'desc') => void;
  };
  selection?: {
    ids: readonly string[];
    eligibleIds: readonly string[];
    disabled: boolean;
    toggle: (id: string) => void;
    togglePage: () => void;
  };
  moveLead: (id: string, stage: DemoStage) => boolean;
  announce: (message: string) => void;
};

const Context = createContext<LeadView | null>(null);

export function LeadViewProvider({ value, children }: { value: LeadView; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLeadView(): LeadView {
  const live = useContext(Context);
  const demo = useOptionalDemoCrm();

  if (live) return live;

  if (demo)
    return { data: demo.data, readOnly: false, moveLead: demo.moveLead, announce: demo.announce };

  throw new Error('Lead views require authorized lead data.');
}
