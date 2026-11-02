import type { ComponentProps } from 'react';

import { fieldClassName } from '@/components/ui/input';
import { cn, focusRing } from '@/lib/utils';

export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={cn(
        fieldClassName,
        focusRing,
        'min-h-12 py-2.5 pr-9 text-base sm:text-sm',
        className,
      )}
    >
      {children}
    </select>
  );
}
