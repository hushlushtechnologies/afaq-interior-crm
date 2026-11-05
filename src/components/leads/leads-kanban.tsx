'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

import { useDemoCrm } from '@/components/demo/demo-crm-provider';
import { DraggableLeadCard, LeadDragPreview } from '@/components/leads/lead-card';
import { Badge } from '@/components/ui/badge';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { DEMO_STAGES } from '@/lib/demo/stages';
import { cn, focusRing } from '@/lib/utils';
import type { DemoLead } from '@/types/demo-crm';

type DemoColumn = (typeof DEMO_STAGES)[number];

function KanbanColumn({ stage, leads }: { stage: DemoColumn; leads: readonly DemoLead[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'stage-' + stage.id,
    data: { stage: stage.id },
  });

  return (
    <section
      ref={setNodeRef}
      data-testid={'stage-' + stage.id}
      aria-labelledby={'stage-heading-' + stage.id}
      className={cn(
        'min-w-0 rounded-card border p-3',
        isOver
          ? stage.protected
            ? 'border-destructive bg-destructive-soft'
            : 'border-ring bg-accent-soft'
          : 'border-border bg-muted/60',
      )}
    >
      <div className="space-y-3 px-1 pt-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h3 id={'stage-heading-' + stage.id} className="text-sm font-semibold">
            {stage.label}
          </h3>
          <Badge tone="outline">{leads.length}</Badge>
        </div>

        {stage.protected && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Protected outcome. Conversion is unavailable in this demo.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {leads.length > 0 ? (
          leads.map((lead) => <DraggableLeadCard key={lead.id} lead={lead} />)
        ) : (
          <p className="rounded-control border border-dashed border-input bg-card p-4 text-xs leading-relaxed text-muted-foreground">
            No sample leads in this stage.
          </p>
        )}
      </div>
    </section>
  );
}

export function LeadsKanban({ leads }: { leads: readonly DemoLead[] }) {
  const { moveLead, announce } = useDemoCrm();
  const [activeId, setActiveId] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const activeLead = leads.find((lead) => lead.id === activeId);

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const stageId: unknown = event.over?.data.current?.stage;
    const stage = DEMO_STAGES.find((item) => item.id === stageId);

    if (!stage) {
      announce('Demo move cancelled. No stage changed.');
      return;
    }

    moveLead(String(event.active.id), stage.id);
  }

  return (
    <section aria-labelledby="sales-board-title" className="space-y-3">
      <h2 id="sales-board-title" className="sr-only">
        Sales pipeline
      </h2>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Drag a handle with a pointer, or use a card’s stage selector. Scroll horizontally to inspect
        all stages.
      </p>

      <DndContext
        id="demo-sales-kanban"
        sensors={sensors}
        collisionDetection={pointerWithin}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Pointer users can drag this handle. Keyboard users can activate the handle to focus the Move stage selector.',
          },
        }}
        onDragStart={(event) => {
          setActiveId(String(event.active.id));
        }}
        onDragCancel={() => {
          setActiveId(null);
          announce('Demo move cancelled.');
        }}
        onDragEnd={handleDragEnd}
      >
        <div
          role="region"
          aria-label="Scrollable sales pipeline"
          tabIndex={0}
          className={cn('relative min-w-0 overflow-x-auto rounded-card pb-4', focusRing)}
        >
          <div className="grid grid-flow-col auto-cols-[18rem] items-start gap-4 p-1">
            {DEMO_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={leads.filter((lead) => lead.stage === stage.id)}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
          {activeLead ? <LeadDragPreview lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
