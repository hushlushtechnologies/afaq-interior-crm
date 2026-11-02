import Link from 'next/link';
import { DetailSection } from '@/components/layout/detail-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/features/access/catalog';
import type { AccessSnapshot } from '@/features/access/types';
import { getVisibleWorkspaceModules } from '@/features/access/workspace-access';
import { workspaceHref } from '@/lib/workspace/navigation';
import { cn, focusRing } from '@/lib/utils';

export function AccessOverview({ snapshot }: { snapshot: AccessSnapshot }) {
  const workspaces = getVisibleWorkspaceModules(snapshot).filter(
    (workspaceModule) => workspaceModule.id !== 'dashboard',
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Open one of the workspaces available to your account."
      />

      <DetailSection id="employee-access" title="Your roles">
        <div className="flex flex-wrap gap-2">
          {snapshot.roles.map((role) => (
            <Badge key={role} tone="info">
              {ROLE_LABELS[role]}
            </Badge>
          ))}
        </div>
      </DetailSection>

      <DetailSection id="available-workspaces" title="Available workspaces">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspaceModule) => (
            <Link
              key={workspaceModule.id}
              href={workspaceHref(workspaceModule.id)}
              className={cn(
                'min-w-0 rounded-control border border-border bg-background p-4 transition-colors hover:bg-muted motion-reduce:transition-none',
                focusRing,
              )}
            >
              <h3 className="font-semibold text-foreground">{workspaceModule.title}</h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {workspaceModule.description}
              </p>
            </Link>
          ))}
        </div>
      </DetailSection>
    </div>
  );
}
