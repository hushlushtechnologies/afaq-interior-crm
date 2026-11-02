'use client';

import { useRef, type ReactNode } from 'react';
import { Dialog, type DialogProps } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ConfirmationDialogProps = Pick<
  DialogProps,
  'open' | 'onOpenChange' | 'title' | 'description' | 'trigger' | 'returnFocusRef'
> & {
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'neutral' | 'destructive';
  pending?: boolean;
  error?: string;
  children?: ReactNode;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  returnFocusRef,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'neutral',
  pending = false,
  error,
  children,
  onConfirm,
}: ConfirmationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      trigger={trigger}
      initialFocusRef={cancelRef}
      returnFocusRef={returnFocusRef}
      closeLabel="Cancel confirmation"
      dismissible={!pending}
      dismissOnOutsideClick={false}
      footer={
        <>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>

          <Button
            type="button"
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            loading={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children || error ? (
        <div className="space-y-4">
          {children}

          {error ? (
            <p
              role="alert"
              className="rounded-control border border-destructive bg-destructive-soft p-3 text-sm leading-6 text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
