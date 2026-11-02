'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

import { ShellDialog } from '@/components/shell/shell-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { findWorkspaceModule } from '@/lib/workspace/navigation';
import type { WorkspaceModuleId } from '@/types/workspace';

export function WorkspaceDetails({ moduleId }: { moduleId: WorkspaceModuleId }) {
  const [open, setOpen] = useState(false);
  const workspaceModule = findWorkspaceModule(moduleId);

  if (!workspaceModule) {
    return null;
  }

  return (
    <ShellDialog
      open={open}
      onOpenChange={setOpen}
      side="right"
      title="Workspace details"
      description="The purpose and current availability of this workspace."
      closeLabel="Close workspace details"
      trigger={
        <Button variant="outline">
          <Icon icon={Info} />
          Workspace details
        </Button>
      }
    >
      <div className="space-y-6">
        <Badge tone="outline">UI placeholder</Badge>

        <dl className="space-y-5">
          <div>
            <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Module
            </dt>
            <dd className="mt-2 text-lg font-semibold">{workspaceModule.title}</dd>
          </div>

          <div>
            <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Purpose
            </dt>
            <dd className="mt-2 text-sm leading-relaxed">{workspaceModule.description}</dd>
          </div>
        </dl>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold">Navigation pages</h3>

          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {workspaceModule.sections.map((section) => (
              <li key={section.slug}>{section.title}</li>
            ))}
          </ul>
        </div>

        <p className="rounded-card bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
          These pages establish layout and navigation. Live records, business actions and access
          control are not connected.
        </p>
      </div>
    </ShellDialog>
  );
}
