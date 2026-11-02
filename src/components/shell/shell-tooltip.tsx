'use client';

import type { ReactElement, ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

export function ShellTooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
      {children}
    </Tooltip.Provider>
  );
}

export function ShellTooltip({
  label,
  children,
  side = 'right',
}: {
  label: string;
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>

      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={10}
          collisionPadding={12}
          className="z-80 max-w-64 rounded-control bg-inverse px-3 py-2 text-xs font-medium text-inverse-foreground shadow-float"
        >
          {label}
          <Tooltip.Arrow className="fill-inverse" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
