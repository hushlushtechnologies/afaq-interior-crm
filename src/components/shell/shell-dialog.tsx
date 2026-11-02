'use client';

import type { ReactElement, ReactNode, RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';

type ShellDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  title: string;
  description: string;
  closeLabel: string;
  children: ReactNode;
  side?: 'left' | 'right' | 'center';
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
};

const positions = {
  left: 'inset-y-2 left-2 w-[min(22rem,calc(100vw-1rem))] data-[state=open]:animate-shell-left-in data-[state=closed]:animate-shell-left-out',
  right:
    'inset-y-2 right-2 w-[min(24rem,calc(100vw-1rem))] data-[state=open]:animate-shell-right-in data-[state=closed]:animate-shell-right-out',
  center:
    'top-1/2 left-1/2 max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 data-[state=open]:animate-shell-fade-in data-[state=closed]:animate-shell-fade-out',
};

export function ShellDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  closeLabel,
  children,
  side = 'center',
  initialFocusRef,
  className,
}: ShellDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-shell-fade-in data-[state=closed]:animate-shell-fade-out motion-reduce:animate-none" />

        <Dialog.Content
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            }
          }}
          className={cn(
            'fixed z-60 flex flex-col overflow-hidden rounded-panel border border-border bg-card text-card-foreground shadow-float outline-none motion-reduce:animate-none',
            positions[side],
            className,
          )}
        >
          <div className="shrink-0 border-b border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <Dialog.Title className="text-lg font-semibold tracking-tight">
                  {title}
                </Dialog.Title>

                <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </Dialog.Description>
              </div>

              <Dialog.Close asChild>
                <IconButton label={closeLabel} icon={X} variant="ghost" className="shrink-0" />
              </Dialog.Close>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
