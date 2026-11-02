'use client';

import { OverlayDialog, type OverlayDialogProps } from '@/components/ui/overlay-dialog';

type DrawerProps = Omit<OverlayDialogProps, 'placement'> & {
  side?: 'left' | 'right';
};

export function Drawer({ side = 'right', closeLabel = 'Close drawer', ...props }: DrawerProps) {
  return <OverlayDialog {...props} placement={side} closeLabel={closeLabel} />;
}
