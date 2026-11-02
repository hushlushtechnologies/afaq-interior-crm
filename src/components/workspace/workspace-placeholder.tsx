import { Info } from 'lucide-react';

import { PageHeader, PageToolbar } from '@/components/layout/page-header';
import { ModuleIcon } from '@/components/shell/module-icon';
import { WorkspaceDetails } from '@/components/shell/workspace-details';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import type { WorkspacePage } from '@/types/workspace';

export function WorkspacePlaceholder({ page }: { page: WorkspacePage }) {
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <PageHeader
        title={page.title}
        eyebrow="Afaq Al Manzel"
        description={page.module.description}
        actions={<WorkspaceDetails moduleId={page.module.id} />}
      />

      <PageToolbar
        leading={<Badge tone="outline">UI preview</Badge>}
        trailing={<p className="text-xs text-muted-foreground">{page.module.title}</p>}
      />

      <div
        role="note"
        className="flex items-start gap-3 rounded-card border border-border bg-card p-4"
      >
        <Icon icon={Info} className="mt-0.5 text-muted-foreground" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          This is a UI preview. Authentication, permissions and live business records are not
          connected.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-5">
          <span className="grid size-14 place-items-center rounded-card bg-secondary text-secondary-foreground">
            <ModuleIcon moduleId={page.module.id} size="lg" />
          </span>

          <div className="space-y-2">
            <CardTitle>This workspace is taking shape.</CardTitle>
            <CardDescription>
              {page.title} is currently a navigation and layout placeholder.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The relevant module sprint will introduce its screens, interactions and business
            functionality. No operational figures or customer information are displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
