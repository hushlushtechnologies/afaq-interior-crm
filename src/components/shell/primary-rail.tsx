'use client';

import Link from 'next/link';
import { useAccess } from '@/components/access/access-provider';
import { ModuleIcon } from '@/components/shell/module-icon';
import { ShellTooltip } from '@/components/shell/shell-tooltip';
import { workspaceHref } from '@/lib/workspace/navigation';
import { cn, focusRing } from '@/lib/utils';
import type { WorkspaceModuleId } from '@/types/workspace';

export function PrimaryRail({ activeModuleId }: { activeModuleId?: WorkspaceModuleId }) {
  const { modules } = useAccess();

  const homeHref = modules[0] ? workspaceHref(modules[0].id) : '/dashboard';

  return (
    <aside
      aria-label="Module rail"
      className="sticky top-3 hidden h-[calc(100svh-1.5rem)] w-20 shrink-0 flex-col items-center bg-inverse py-4 text-inverse-foreground md:flex"
    >
      <Link
        href={homeHref}
        aria-label="Afaq workspace home"
        className={cn(
          'mb-4 grid size-12 shrink-0 place-items-center rounded-control border border-inverse-muted/40 text-xl font-semibold',
          focusRing,
          'focus-visible:outline-inverse-foreground',
        )}
      >
        <span aria-hidden="true">A</span>
      </Link>

      <nav
        aria-label="Primary navigation"
        className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto px-3 py-2"
      >
        <ul className="space-y-2">
          {modules.map((workspaceModule) => {
            const active = workspaceModule.id === activeModuleId;

            return (
              <li key={workspaceModule.id}>
                <ShellTooltip label={workspaceModule.title}>
                  <Link
                    href={workspaceHref(workspaceModule.id)}
                    aria-label={workspaceModule.title}
                    aria-current={active ? 'location' : undefined}
                    className={cn(
                      'flex min-h-12 items-center justify-center rounded-control transition-colors motion-reduce:transition-none',
                      focusRing,
                      'focus-visible:outline-inverse-foreground',
                      active
                        ? 'bg-card text-foreground'
                        : 'text-inverse-muted hover:bg-inverse-foreground/10 hover:text-inverse-foreground',
                    )}
                  >
                    <ModuleIcon moduleId={workspaceModule.id} />
                  </Link>
                </ShellTooltip>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="mt-4 shrink-0 text-[10px] font-semibold tracking-widest text-inverse-muted uppercase">
        Preview
      </p>
    </aside>
  );
}
