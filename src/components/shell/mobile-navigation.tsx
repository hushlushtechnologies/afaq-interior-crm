'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useAccess } from '@/components/access/access-provider';
import { ModuleIcon } from '@/components/shell/module-icon';
import { SectionNavigation } from '@/components/shell/section-navigation';
import { ShellDialog } from '@/components/shell/shell-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { Separator } from '@/components/ui/separator';
import { Eyebrow } from '@/components/ui/typography';
import { workspaceHref } from '@/lib/workspace/navigation';
import { cn, focusRing } from '@/lib/utils';
import type { WorkspaceModule } from '@/types/workspace';

export function MobileNavigation({
  module: workspaceModule,
  pathname,
}: {
  module: WorkspaceModule;
  pathname: string;
}) {
  const { modules } = useAccess();
  const [open, setOpen] = useState(false);

  const currentModule = modules.find((item) => item.id === workspaceModule.id);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');

    function handleChange(event: MediaQueryListEvent) {
      if (event.matches) {
        setOpen(false);
      }
    }

    media.addEventListener('change', handleChange);

    return () => media.removeEventListener('change', handleChange);
  }, []);

  function closeNavigation() {
    setOpen(false);
  }

  return (
    <ShellDialog
      open={open}
      onOpenChange={setOpen}
      side="left"
      title="Workspace navigation"
      description="Choose an available module or page."
      closeLabel="Close navigation"
      trigger={
        <IconButton label="Open navigation" icon={Menu} variant="ghost" className="lg:hidden" />
      }
    >
      <div className="space-y-6">
        <div>
          <Eyebrow className="mb-3">Modules</Eyebrow>

          <nav aria-label="Modules in drawer">
            {modules.length ? (
              <ul className="grid grid-cols-2 gap-2">
                {modules.map((item) => {
                  const active = item.id === workspaceModule.id;

                  return (
                    <li key={item.id}>
                      <Link
                        href={workspaceHref(item.id)}
                        onClick={closeNavigation}
                        aria-current={active ? 'location' : undefined}
                        className={cn(
                          'flex min-h-13 items-center gap-2 rounded-control border px-3 py-2 text-sm',
                          focusRing,
                          active
                            ? 'border-secondary bg-secondary font-semibold text-secondary-foreground'
                            : 'border-border bg-card text-foreground hover:bg-muted',
                        )}
                      >
                        <ModuleIcon moduleId={item.id} size="sm" />

                        <span className="min-w-0 wrap-break-word">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                No workspaces are available. Ask your Super Admin to review your roles.
              </p>
            )}
          </nav>
        </div>

        {currentModule ? (
          <>
            <Separator />

            <div>
              <Eyebrow className="mb-3">{currentModule.title}</Eyebrow>

              <SectionNavigation
                module={currentModule}
                pathname={pathname}
                onNavigate={closeNavigation}
                label="Current section in drawer"
              />
            </div>
          </>
        ) : null}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Your employee roles determine which pages appear. Record access can also depend on
          assignment.
        </p>
      </div>
    </ShellDialog>
  );
}
