import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function PageContainer({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8', className)}
    />
  );
}
