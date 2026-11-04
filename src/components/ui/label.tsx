import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type LabelProps = ComponentProps<'label'> & {
  htmlFor: string;
  required?: boolean;
};

export function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <label
      {...props}
      className={cn('inline-block text-sm font-semibold text-foreground', className)}
    >
      {children}
      {required && (
        <span aria-hidden="true" className="ml-1 text-destructive after:content-['*']" />
      )}
    </label>
  );
}