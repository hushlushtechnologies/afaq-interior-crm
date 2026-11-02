import type { ComponentProps } from 'react';
import { cn, focusRing } from '@/lib/utils';

export const fieldClassName =
  'w-full min-w-0 rounded-control border border-input bg-card px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground transition-colors duration-150 motion-reduce:transition-none aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      type={type}
      className={cn(fieldClassName, focusRing, 'min-h-12', className)}
    />
  );
}
