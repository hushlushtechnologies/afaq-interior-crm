'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';

export type OverlayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  trigger?: ReactElement;
  children?: ReactNode;
  footer?: ReactNode;
  placement?: 'center' | 'left' | 'right';
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  closeLabel?: string;
  dismissible?: boolean;
  dismissOnOutsideClick?: boolean;
  className?: string;
};

export function OverlayDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  footer,
  placement = 'center',
  initialFocusRef,
  returnFocusRef,
  closeLabel = 'Close dialog',
  dismissible = true,
  dismissOnOutsideClick = true,
  className,
}: OverlayDialogProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !dismissible) {
      return;
    }

    onOpenChange(nextOpen);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-80 bg-overlay backdrop-blur-sm',
            'motion-safe:data-[state=open]:animate-shell-fade-in',
            'motion-safe:data-[state=closed]:animate-shell-fade-out',
          )}
        />

        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            const target = initialFocusRef?.current;

            if (!target || target.matches(':disabled')) {
              return;
            }

            event.preventDefault();
            target.focus();
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef?.current;

            if (!target?.isConnected || target.matches(':disabled')) {
              return;
            }

            event.preventDefault();
            target.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (!dismissible) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (!dismissible || !dismissOnOutsideClick) {
              event.preventDefault();
            }
          }}
          className={cn(
            'fixed z-90 flex min-w-0 flex-col overflow-hidden border border-border bg-card text-foreground shadow-floating outline-none',
            placement === 'center' && [
              'inset-x-4 top-1/2 max-h-[calc(100dvh_-_2rem)] -translate-y-1/2 rounded-panel',
              'sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2',
              'motion-safe:data-[state=open]:animate-shell-fade-in',
              'motion-safe:data-[state=closed]:animate-shell-fade-out',
            ],
            placement === 'right' && [
              'inset-y-0 right-0 w-full max-w-md sm:rounded-l-panel',
              'motion-safe:data-[state=open]:animate-shell-right-in',
              'motion-safe:data-[state=closed]:animate-shell-right-out',
            ],
            placement === 'left' && [
              'inset-y-0 left-0 w-full max-w-md sm:rounded-r-panel',
              'motion-safe:data-[state=open]:animate-shell-left-in',
              'motion-safe:data-[state=closed]:animate-shell-left-out',
            ],
            className,
          )}
        >
          <header className="relative shrink-0 border-b border-border p-5 pr-16 sm:p-6 sm:pr-18">
            <DialogPrimitive.Title className="text-xl font-semibold tracking-tight">
              {title}
            </DialogPrimitive.Title>

            <DialogPrimitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </DialogPrimitive.Description>

            <DialogPrimitive.Close asChild>
              <IconButton
                type="button"
                label={closeLabel}
                icon={X}
                variant="ghost"
                disabled={!dismissible}
                className="absolute right-2 top-2"
              />
            </DialogPrimitive.Close>
          </header>

          {children ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
              {children}
            </div>
          ) : null}

          {footer ? (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border p-5 sm:p-6">
              {footer}
            </footer>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
