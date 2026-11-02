'use client';

import { OverlayDialog, type OverlayDialogProps } from '@/components/ui/overlay-dialog';

export type DialogProps = Omit<OverlayDialogProps, 'placement'>;

export function Dialog(props: DialogProps) {
  return <OverlayDialog {...props} placement="center" />;
}
