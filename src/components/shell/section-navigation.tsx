'use client';

import Link from 'next/link';
import { useAccess } from '@/components/access/access-provider';
import { workspaceHref } from '@/lib/workspace/navigation';
import { cn, focusRing } from '@/lib/utils';
import type { WorkspaceModule } from '@/types/workspace';

type SectionNavigationProps = {
  module: WorkspaceModule;
  pathname: string;
  onNavigate?: () => void;
  label?: string;
};

export function SectionNavigation({
  module: workspaceModule,
  pathname,
  onNavigate,
  label = 'Current section',
}: SectionNavigationProps) {
  const { canOpenPath } = useAccess();

  const isLeadDetails = workspaceModule.id === 'leads' && pathname.startsWith('/leads/details/');

  const sections = workspaceModule.sections.filter((section) =>
    canOpenPath(workspaceHref(workspaceModule.id, section.slug)),
  );

  return (
    <nav aria-label={label}>
      <ul className="space-y-1">
        {sections.map((section) => {
          const href = workspaceHref(workspaceModule.id, section.slug);

          const isActive = pathname === href || (isLeadDetails && section.slug === '');

          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 items-center rounded-control border px-3.5 py-3 text-sm font-medium transition-colors motion-reduce:transition-none',
                  focusRing,
                  isActive
                    ? 'border-border bg-card text-foreground shadow-control'
                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {section.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
