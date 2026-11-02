'use client';

import { FlaskConical, RotateCcw } from 'lucide-react';

import { useDemoCrm } from '@/components/demo/demo-crm-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { formatDemoDate } from '@/lib/demo/format';
import { cn, focusRing } from '@/lib/utils';
import type { DemoPreviewState } from '@/types/demo-crm';

export function DemoBanner() {
  const { data, previewState, setPreviewState, resetDemo } = useDemoCrm();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-accent-soft p-4">
      <div className="min-w-0 space-y-2">
        <Badge tone="outline">
          <Icon icon={FlaskConical} size="sm" />
          Demonstration data
        </Badge>

        <p className="text-xs leading-relaxed text-accent-foreground">
          Fictional snapshot · {formatDemoDate(data.asOfDate)}. Changes stay in this tab.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="demo-state-selector">Preview state</Label>

          <select
            id="demo-state-selector"
            value={previewState}
            onChange={(event) => setPreviewState(event.target.value as DemoPreviewState)}
            className={cn(
              'min-h-11 rounded-control border border-input bg-card px-3 text-sm text-foreground',
              focusRing,
            )}
          >
            <option value="ready">Ready</option>
            <option value="loading">Loading example</option>
            <option value="empty">Empty example</option>
            <option value="error">Error example</option>
          </select>
        </div>

        <Button variant="outline" size="sm" onClick={resetDemo}>
          <Icon icon={RotateCcw} size="sm" />
          Reset demo
        </Button>
      </div>
    </div>
  );
}
