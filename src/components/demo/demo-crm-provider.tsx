'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
import { DEMO_STAGES, isProtectedDemoStage } from '@/lib/demo/stages';
import type { DemoDataset, DemoLead, DemoPreviewState, DemoStage } from '@/types/demo-crm';

type DemoCrmContextValue = {
  data: DemoDataset;
  previewState: DemoPreviewState;
  setPreviewState: (state: DemoPreviewState) => void;
  announce: (message: string) => void;
  resetDemo: () => void;
  moveLead: (leadId: string, stage: DemoStage) => boolean;
  assignOwner: (leadId: string, ownerId: string) => void;
  addNote: (leadId: string, body: string) => void;
  toggleRequirement: (leadId: string, requirementId: string) => void;
};

const DemoCrmContext = createContext<DemoCrmContextValue | null>(null);

function cloneLeads(leads: readonly DemoLead[]): DemoLead[] {
  return leads.map((lead) => ({
    ...lead,
    requirements: lead.requirements.map((item) => ({ ...item })),
    rooms: lead.rooms.map((item) => ({ ...item })),
    notes: lead.notes.map((item) => ({ ...item })),
    activities: lead.activities.map((item) => ({ ...item })),
    attachments: lead.attachments.map((item) => ({ ...item })),
  }));
}

export function DemoCrmProvider({
  initialData,
  children,
}: {
  initialData: DemoDataset;
  children: ReactNode;
}) {
  const [leads, setLeads] = useState(() => cloneLeads(initialData.leads));
  const [previewState, setPreviewState] = useState<DemoPreviewState>('ready');
  const [message, setMessage] = useState<string | null>(null);

  const announce = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
  }, []);

  const resetDemo = useCallback(() => {
    setLeads(cloneLeads(initialData.leads));
    setPreviewState('ready');
    setMessage('Demo data reset. No server records were changed.');
  }, [initialData]);

  const moveLead = useCallback(
    (leadId: string, stage: DemoStage): boolean => {
      const lead = leads.find((item) => item.id === leadId);

      if (!lead || !DEMO_STAGES.some((item) => item.id === stage)) {
        setMessage('That demo move is unavailable.');
        return false;
      }

      if (isProtectedDemoStage(lead.stage) || isProtectedDemoStage(stage)) {
        setMessage(
          'Won and Lost are protected outcomes. Conversion and reopening are unavailable in this prototype.',
        );
        return false;
      }

      if (lead.stage === stage) {
        return true;
      }

      setLeads((current) =>
        current.map((item) => (item.id === leadId ? { ...item, stage } : item)),
      );

      setMessage('Demo stage updated for ' + lead.clientName + '. No database record was changed.');

      return true;
    },
    [leads],
  );

  const assignOwner = useCallback(
    (leadId: string, ownerId: string) => {
      if (!initialData.owners.some((owner) => owner.id === ownerId)) {
        setMessage('Choose an available sample owner.');
        return;
      }

      setLeads((current) =>
        current.map((lead) => (lead.id === leadId ? { ...lead, ownerId } : lead)),
      );

      setMessage('Sample assignment updated in this tab only.');
    },
    [initialData.owners],
  );

  const addNote = useCallback((leadId: string, body: string) => {
    const trimmed = body.trim();

    if (!trimmed || trimmed.length > 1000) {
      setMessage('Enter a note between 1 and 1,000 characters.');
      return;
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              notes: [
                ...lead.notes,
                {
                  id,
                  body: trimmed,
                  authorId: lead.ownerId,
                  createdAt,
                },
              ],
              activities: [
                ...lead.activities,
                {
                  id: id + '-activity',
                  kind: 'note',
                  summary: 'A local prototype note was added.',
                  at: createdAt,
                },
              ],
            }
          : lead,
      ),
    );

    setMessage('Note added to local demo state. Reloading resets it.');
  }, []);

  const toggleRequirement = useCallback((leadId: string, requirementId: string) => {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              requirements: lead.requirements.map((item) =>
                item.id === requirementId ? { ...item, completed: !item.completed } : item,
              ),
            }
          : lead,
      ),
    );

    setMessage('Sample checklist updated in this tab only.');
  }, []);

  const value = useMemo<DemoCrmContextValue>(
    () => ({
      data: { ...initialData, leads },
      previewState,
      setPreviewState,
      announce,
      resetDemo,
      moveLead,
      assignOwner,
      addNote,
      toggleRequirement,
    }),
    [
      initialData,
      leads,
      previewState,
      announce,
      resetDemo,
      moveLead,
      assignOwner,
      addNote,
      toggleRequirement,
    ],
  );

  return (
    <DemoCrmContext.Provider value={value}>
      {children}

      {message && (
        <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-start gap-3 rounded-card border border-border bg-card p-4 shadow-float">
          <p role="status" className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Demo update: </span>
            {message}
          </p>

          <IconButton
            label="Dismiss preview message"
            icon={X}
            variant="ghost"
            onClick={() => setMessage(null)}
            className="-mt-2 -mr-2 shrink-0"
          />
        </div>
      )}
    </DemoCrmContext.Provider>
  );
}

export function useDemoCrm(): DemoCrmContextValue {
  const context = useContext(DemoCrmContext);

  if (!context) {
    throw new Error('Demo CRM components require the development DemoCrmProvider.');
  }

  return context;
}

export function useOptionalDemoCrm() {
  return useContext(DemoCrmContext);
}
