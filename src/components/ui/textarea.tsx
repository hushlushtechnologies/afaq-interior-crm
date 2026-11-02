import type { ComponentProps } from 'react';
import { cn, focusRing } from '@/lib/utils';
import { fieldClassName } from './input';

export function Textarea({ className, rows = 4, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={cn(fieldClassName, focusRing, 'min-h-28 resize-y', className)}
    />
  );
}
