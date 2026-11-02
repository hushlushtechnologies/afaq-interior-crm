'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { PrimaryRail } from '@/components/shell/primary-rail';
import { SecondaryNavigation } from '@/components/shell/secondary-navigation';
import { ShellTooltipProvider } from '@/components/shell/shell-tooltip';
import { WorkspaceHeader } from '@/components/shell/workspace-header';
import { WORKSPACE_MODULES, getWorkspacePageFromPath } from '@/lib/workspace/navigation';
import { cn, focusRing } from '@/lib/utils';
import type { WorkspacePreviewUser } from '@/types/workspace';

export function AppShell({
  user,
  children,
}: {
  user: WorkspacePreviewUser | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const page = getWorkspacePageFromPath(pathname);
  const workspaceModule = page?.module ?? WORKSPACE_MODULES[0];

  const [secondaryExpanded, setSecondaryExpanded] = useState(true);

  return (
    <ShellTooltipProvider>
      <div className="min-h-svh bg-background p-2 sm:p-3">
        <a
          href="#workspace-content"
          className={cn(
            'sr-only fixed top-3 left-3 z-100 rounded-control bg-primary px-4 py-3 text-sm text-primary-foreground focus:not-sr-only',
            focusRing,
          )}
        >
          Skip to workspace content
        </a>

        <div className="mx-auto flex min-h-[calc(100svh-1rem)] max-w-[1800px] overflow-clip rounded-panel border border-border bg-card shadow-float sm:min-h-[calc(100svh-1.5rem)]">
          <PrimaryRail activeModuleId={page?.module.id} />

          <SecondaryNavigation
            module={workspaceModule}
            pathname={pathname}
            expanded={secondaryExpanded}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <WorkspaceHeader
              page={page}
              module={workspaceModule}
              pathname={pathname}
              user={user}
              secondaryExpanded={secondaryExpanded}
              onToggleSecondary={() => setSecondaryExpanded((expanded) => !expanded)}
            />

            <main
              id="workspace-content"
              tabIndex={-1}
              className="min-w-0 flex-1 bg-background p-4 outline-none sm:p-6 xl:p-8"
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </ShellTooltipProvider>
  );
}
