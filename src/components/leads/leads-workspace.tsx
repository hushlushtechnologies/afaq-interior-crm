'use client';

import { useMemo, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';

import { DemoBanner } from '@/components/demo/demo-banner';
import { useDemoCrm } from '@/components/demo/demo-crm-provider';
import { DemoStatePanel } from '@/components/demo/demo-state-panel';
import { LeadFilterBar } from '@/components/leads/lead-filter-bar';
import { LeadsKanban } from '@/components/leads/leads-kanban';
import { LeadsTable } from '@/components/leads/leads-table';
import { PageHeader, PageToolbar } from '@/components/layout/page-header';
import { WorkspaceDetails } from '@/components/shell/workspace-details';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  EMPTY_LEAD_FILTERS,
  filterDemoLeads,
  sortDemoLeads,
  type LeadBoardSort,
  type LeadFilters,
  type LeadView,
} from '@/lib/demo/lead-views';
import { cn, focusRing } from '@/lib/utils';

export function LeadsWorkspace({ title, initialView }: { title: string; initialView: LeadView }) {
  const { data, previewState, setPreviewState } = useDemoCrm();

  const [view, setView] = useState<LeadView>(initialView);
  const [filters, setFilters] = useState<LeadFilters>(() => ({
    ...EMPTY_LEAD_FILTERS,
  }));
  const [boardSort, setBoardSort] = useState<LeadBoardSort>('newest');

  const visibleLeads = useMemo(
    () => (previewState === 'empty' ? [] : filterDemoLeads(data.leads, data.owners, filters)),
    [data.leads, data.owners, filters, previewState],
  );

  const boardLeads = useMemo(
    () => sortDemoLeads(visibleLeads, boardSort),
    [visibleLeads, boardSort],
  );

  const showStatePanel = previewState === 'loading' || previewState === 'error';

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <PageHeader
        title={title}
        eyebrow="Sales workspace"
        description="Explore fictional inquiries. Search, filter and change open stages locally."
        actions={<WorkspaceDetails moduleId="leads" />}
      />

      <DemoBanner />

      <LeadFilterBar
        filters={filters}
        owners={data.owners}
        onChange={setFilters}
        onClear={() => setFilters({ ...EMPTY_LEAD_FILTERS })}
      />

      <PageToolbar
        leading={
          <p
            id="lead-results-status"
            tabIndex={-1}
            className={cn('rounded-control text-sm text-muted-foreground', focusRing)}
          >
            {visibleLeads.length} of {data.leads.length} sample leads
          </p>
        }
        trailing={
          <>
            {view === 'kanban' && (
              <div className="min-w-40">
                <Label htmlFor="lead-board-sort" className="sr-only">
                  Sort Kanban cards
                </Label>

                <NativeSelect
                  id="lead-board-sort"
                  value={boardSort}
                  onChange={(event) => setBoardSort(event.target.value as LeadBoardSort)}
                >
                  <option value="newest">Newest first</option>
                  <option value="budget-high">Highest budget</option>
                  <option value="name">Client name</option>
                </NativeSelect>
              </div>
            )}

            <div
              role="group"
              aria-label="Lead view"
              className="flex items-center gap-1 rounded-control border border-border bg-card p-1"
            >
              <Button
                variant={view === 'kanban' ? 'primary' : 'ghost'}
                size="sm"
                aria-label="Show Kanban view"
                aria-pressed={view === 'kanban'}
                onClick={() => setView('kanban')}
              >
                <Icon icon={LayoutGrid} size="sm" />
                Kanban
              </Button>

              <Button
                variant={view === 'table' ? 'primary' : 'ghost'}
                size="sm"
                aria-label="Show table view"
                aria-pressed={view === 'table'}
                onClick={() => setView('table')}
              >
                <Icon icon={List} size="sm" />
                Table
              </Button>
            </div>
          </>
        }
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Won and Lost are protected. This prototype cannot convert, close or reopen an opportunity.
      </p>

      {showStatePanel ? (
        <DemoStatePanel state={previewState} onRetry={() => setPreviewState('ready')} />
      ) : view === 'kanban' ? (
        <LeadsKanban leads={boardLeads} />
      ) : (
        <LeadsTable leads={visibleLeads} />
      )}
    </div>
  );
}
