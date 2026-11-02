import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type SeparatorProps = Omit<ComponentProps<'div'>, 'children'> & {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
};

export function Separator({
  orientation = 'horizontal',
  decorative = true,
  className,
  ...props
}: SeparatorProps) {
  return (
    <div
      {...props}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-6 w-px',
        className,
      )}
    />
  );
}
