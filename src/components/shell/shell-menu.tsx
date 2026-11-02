'use client';

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { cn } from '@/lib/utils';

export function ShellMenu({
  trigger,
  label,
  header,
  children,
}: {
  trigger: ReactElement;
  label: string;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          aria-label={label}
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-70 w-72 max-w-[calc(100vw-1rem)] rounded-card border border-border bg-card p-2 text-card-foreground shadow-float outline-none data-[state=open]:animate-shell-fade-in data-[state=closed]:animate-shell-fade-out motion-reduce:animate-none"
        >
          <DropdownMenu.Label className="px-3 py-3">{header}</DropdownMenu.Label>

          <DropdownMenu.Separator className="my-2 h-px bg-border" />

          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ShellMenuLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-sm font-medium outline-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
          className,
        )}
      >
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}

export function ShellMenuSeparator() {
  return <DropdownMenu.Separator className="my-2 h-px bg-border" />;
}
