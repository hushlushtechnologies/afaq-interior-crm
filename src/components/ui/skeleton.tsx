import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-control bg-secondary motion-reduce:animate-none',
        className,
      )}
    />
  );
}
