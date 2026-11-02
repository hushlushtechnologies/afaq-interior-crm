import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { DEMO_SOURCES, type LeadFilters } from '@/lib/demo/lead-views';
import { DEMO_STAGES } from '@/lib/demo/stages';
import type { DemoOwner } from '@/types/demo-crm';

export function LeadFilterBar({
  filters,
  owners,
  onChange,
  onClear,
}: {
  filters: LeadFilters;
  owners: readonly DemoOwner[];
  onChange: (filters: LeadFilters) => void;
  onClear: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-5 sm:pt-6">
        <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2 sm:col-span-2 xl:col-span-1">
            <Label htmlFor="lead-search">Search demo leads</Label>

            <div className="relative">
              <Icon
                icon={Search}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />

              <Input
                id="lead-search"
                type="search"
                value={filters.query}
                onChange={(event) => onChange({ ...filters, query: event.target.value })}
                placeholder="Client, project or owner"
                aria-describedby="lead-filter-help"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-source-filter">Source</Label>

            <NativeSelect
              id="lead-source-filter"
              value={filters.source}
              onChange={(event) =>
                onChange({
                  ...filters,
                  source: event.target.value as LeadFilters['source'],
                })
              }
            >
              <option value="all">All sources</option>
              {DEMO_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-owner-filter">Owner</Label>

            <NativeSelect
              id="lead-owner-filter"
              value={filters.ownerId}
              onChange={(event) => onChange({ ...filters, ownerId: event.target.value })}
            >
              <option value="all">All sample owners</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-stage-filter">Stage</Label>

            <NativeSelect
              id="lead-stage-filter"
              value={filters.stage}
              onChange={(event) =>
                onChange({
                  ...filters,
                  stage: event.target.value as LeadFilters['stage'],
                })
              }
            >
              <option value="all">All stages</option>
              {DEMO_STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-priority-filter">Priority</Label>

            <NativeSelect
              id="lead-priority-filter"
              value={filters.priority}
              onChange={(event) =>
                onChange({
                  ...filters,
                  priority: event.target.value as LeadFilters['priority'],
                })
              }
            >
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </NativeSelect>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id="lead-filter-help" className="text-xs text-muted-foreground">
            Filters apply to fictional data in both Kanban and table views.
          </p>

          <Button variant="ghost" size="sm" onClick={onClear}>
            <Icon icon={X} size="sm" />
            Clear filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
