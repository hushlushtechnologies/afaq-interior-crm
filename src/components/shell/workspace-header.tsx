'use client';

import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
} from 'lucide-react';

import { FollowUpNotifications } from '@/components/shell/follow-up-notifications';
import { MobileNavigation } from '@/components/shell/mobile-navigation';
import { NavigationSearch } from '@/components/shell/navigation-search';
import { ShellMenu, ShellMenuLink, ShellMenuSeparator } from '@/components/shell/shell-menu';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { cn, focusRing } from '@/lib/utils';
import { workspaceHref } from '@/lib/workspace/navigation';
import type { WorkspaceModule, WorkspacePage, WorkspacePreviewUser } from '@/types/workspace';

export function WorkspaceHeader({
  page,
  module,
  pathname,
  user,
  secondaryExpanded,
  onToggleSecondary,
}: {
  page: WorkspacePage | null;
  module: WorkspaceModule;
  pathname: string;
  user: WorkspacePreviewUser | null;
  secondaryExpanded: boolean;
  onToggleSecondary: () => void;
}) {
  const displayName = user?.name ?? 'Account not connected';

  return (
    <header className="glass-panel sticky top-0 z-20 border-b border-border">
      <div className="flex min-h-20 items-center gap-2 px-3 sm:px-5">
        <MobileNavigation module={module} pathname={pathname} />

        <IconButton
          label={secondaryExpanded ? 'Collapse navigation' : 'Expand navigation'}
          icon={secondaryExpanded ? PanelLeftClose : PanelLeftOpen}
          variant="ghost"
          aria-expanded={secondaryExpanded}
          aria-controls="secondary-navigation"
          onClick={onToggleSecondary}
          className="hidden lg:inline-flex"
        />

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1 text-sm">
          <ol className="flex min-w-0 items-center gap-2">
            <li className="hidden shrink-0 items-center gap-2 xl:flex">
              <Link
                href="/dashboard"
                className={cn(
                  'inline-flex min-h-11 items-center rounded-control text-muted-foreground hover:text-foreground',
                  focusRing,
                )}
              >
                Workspace
              </Link>
              <Icon icon={ChevronRight} size="sm" className="text-muted-foreground" />
            </li>

            <li
              className={cn(
                'min-w-0 items-center gap-2',
                page?.section.slug ? 'hidden sm:flex' : 'flex',
              )}
            >
              <Link
                href={workspaceHref(module.id)}
                aria-current={page && !page.section.slug ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 min-w-0 items-center rounded-control',
                  focusRing,
                )}
              >
                <span className="truncate">{module.title}</span>
              </Link>

              {page?.section.slug && (
                <Icon icon={ChevronRight} size="sm" className="shrink-0 text-muted-foreground" />
              )}
            </li>

            {page?.section.slug && (
              <li aria-current="page" className="min-w-0 truncate font-semibold">
                {page.section.title}
              </li>
            )}
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <NavigationSearch />

          <FollowUpNotifications />

          <ShellMenu
            label="Profile actions"
            trigger={
              <button
                type="button"
                aria-label="Open profile menu"
                className={cn(
                  'flex min-h-12 shrink-0 items-center gap-2 rounded-control p-1.5 hover:bg-muted',
                  focusRing,
                )}
              >
                <Avatar name={displayName} size="sm" />

                <span className="hidden min-w-0 max-w-40 text-left 2xl:block">
                  <span className="block truncate text-sm font-semibold">{displayName}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {user ? 'Demo preview' : 'No authentication'}
                  </span>
                </span>

                <Icon icon={ChevronDown} size="sm" className="hidden sm:block" />
              </button>
            }
            header={
              <div className="space-y-1">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.label ?? 'Authentication is not connected.'}
                </p>
                {user && <p className="text-xs text-muted-foreground">{user.email}</p>}
              </div>
            }
          >
            <ShellMenuLink href="/settings/profile">
              <Icon icon={UserRound} size="sm" />
              Profile
            </ShellMenuLink>

            <ShellMenuLink href="/settings/preferences">
              <Icon icon={Settings} size="sm" />
              Preferences
            </ShellMenuLink>

            {user && (
              <>
                <ShellMenuSeparator />
                <ShellMenuLink href="/dev/design-system">Design system</ShellMenuLink>
              </>
            )}
          </ShellMenu>
        </div>
      </div>
    </header>
  );
}